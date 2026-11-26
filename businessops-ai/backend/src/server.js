import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {createRequire} from 'node:module';
import {db,audit,initDb,checkDbHealth,closeDb,withTransaction} from './db.js';

dotenv.config({path:path.resolve(process.cwd(),'../.env')});
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(import.meta.url);
const multer=require('multer');

const app=express(), PORT=process.env.PORT||4000, SECRET=process.env.JWT_SECRET||'local-development-secret-change-me';

// ─── Nodemailer transporter (Gmail / SMTP) ────────────────────────────────
const SMTP_USER = process.env.email_user || process.env.SMTP_USER || '';
const SMTP_PASS = process.env.email_password || process.env.SMTP_PASS || '';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

let transporter = null;
if (SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  transporter.verify().then(() => {
    console.log('✅ Nodemailer SMTP ready — emails will be sent');
  }).catch(e => {
    console.warn('⚠️  Nodemailer SMTP not reachable:', e.message);
    transporter = null;
  });
}

async function sendResetEmail(toEmail, userName, code) {
  if (!transporter) return false;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:12px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="display:inline-block;background:linear-gradient(135deg,#1e3a8a,#2563eb);border-radius:12px;padding:12px 20px;">
          <span style="color:#fff;font-size:22px;font-weight:800;">✦ Khata AI</span>
        </div>
      </div>
      <h2 style="color:#0f172a;margin-bottom:8px;">Password Reset Request</h2>
      <p style="color:#475569;margin-bottom:20px;">Hi <strong>${userName}</strong>, we received a request to reset your Khata AI password.</p>
      <div style="background:#fff;border:2px solid #e2e8f0;border-radius:10px;padding:20px 24px;text-align:center;margin-bottom:20px;">
        <p style="color:#64748b;font-size:13px;margin:0 0 8px;">Your 6-digit verification code:</p>
        <div style="font-family:monospace;font-size:36px;font-weight:800;letter-spacing:8px;color:#1e40af;">${code}</div>
        <p style="color:#94a3b8;font-size:12px;margin:10px 0 0;">Valid for <strong>15 minutes</strong>. Do not share this code.</p>
      </div>
      <p style="color:#64748b;font-size:13px;">If you did not request this, you can safely ignore this email — your password will remain unchanged.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
      <p style="color:#94a3b8;font-size:11px;text-align:center;">© ${new Date().getFullYear()} Khata AI · Secure Business Management</p>
    </div>`;
  try {
    await transporter.sendMail({
      from: `"Khata AI" <${SMTP_FROM}>`,
      to: toEmail,
      subject: '🔑 Khata AI — Password Reset Code',
      html,
      text: `Hi ${userName},\n\nYour Khata AI password reset code is: ${code}\n\nThis code is valid for 15 minutes.\n\nIf you did not request this, ignore this email.\n\n— Khata AI`
    });
    return true;
  } catch(e) {
    console.error('Email send error:', e.message);
    return false;
  }
}

// Upload storage
const uploadsDir=path.resolve(__dirname,'../uploads');
fs.mkdirSync(uploadsDir,{recursive:true});
const storage=multer.diskStorage({
  destination:(req,file,cb)=>cb(null,uploadsDir),
  filename:(req,file,cb)=>{const ext=path.extname(file.originalname); cb(null,'inv-'+Date.now()+ext)}
});
const upload=multer({storage,limits:{fileSize:10*1024*1024},fileFilter:(req,file,cb)=>{
  const ok=['image/jpeg','image/png','image/jpg','application/pdf'];
  cb(null,ok.includes(file.mimetype));
}});

app.use(helmet({crossOriginResourcePolicy:false,contentSecurityPolicy:false}));
app.use(cors({origin:process.env.CORS_ORIGIN?.split(',')||true}));
app.use(express.json({limit:'4mb'}));
app.use(rateLimit({windowMs:60000,limit:300,standardHeaders:true,legacyHeaders:false}));

// Serve uploaded invoices as static files
app.use('/uploads',express.static(uploadsDir));

const auth=(req,res,next)=>{
  const token=req.headers.authorization?.replace(/^Bearer /,'');
  if(!token){
    return res.status(401).json({error:'Unauthorized: Please sign in to Khata AI'});
  }
  try{
    req.user=jwt.verify(token,SECRET);
    next();
  }catch{
    return res.status(401).json({error:'Session expired. Please sign in again.'});
  }
};
const sendError=(res,e)=>res.status(e.status||400).json({error:e.message||'Request failed'});
const biz=req=>req.user.business_id;

// ─── Health ────────────────────────────────────────────────────────────────
app.get('/api/health',async(req,res)=>{
  try{
    await checkDbHealth();
    res.json({ok:true,service:'Khata AI API',database:'connected'});
  }catch{
    res.status(503).json({ok:false,service:'Khata AI API',database:'disconnected'});
  }
});

// ─── Khata AI Auth (Authentication & Authorization) ────────────────────────
app.post('/api/auth/khata-signup',async(req,res)=>{
  try{
    // Accept separate phone and email fields (not combined)
    const s=z.object({
      userName: z.string().min(1,'User name is required'),
      businessName: z.string().min(1,'Name of the business is required'),
      address: z.string().optional().default(''),
      phone: z.string().min(6,'Phone number is required'),
      email: z.string().email('A valid Gmail address is required'),
      password: z.string().min(4,'Password must be at least 4 characters')
    }).parse(req.body);

    const phone = s.phone.trim();
    const email = s.email.trim().toLowerCase();

    // Check for duplicate phone or email
    const existingByPhone=await db.get(
      'SELECT id FROM users WHERE LOWER(phone)=LOWER($1)',
      [phone]
    );
    if(existingByPhone){
      return res.status(400).json({error:`An account with phone number ${phone} already exists. Please log in or reset your password.`});
    }
    const existingByEmail=await db.get(
      'SELECT id FROM users WHERE LOWER(email)=LOWER($1)',
      [email]
    );
    if(existingByEmail){
      return res.status(400).json({error:`An account with ${email} already exists. Please log in or reset your password.`});
    }

    const hash=await bcrypt.hash(s.password,10);
    const user=await withTransaction(async(client)=>{
      const bResult=await client.query(
        'INSERT INTO businesses(name,category,currency,address,phone) VALUES($1,$2,$3,$4,$5) RETURNING id',
        [s.businessName,'Retail','NPR',s.address,phone]
      );
      const businessId=bResult.rows[0].id;
      const uResult=await client.query(
        'INSERT INTO users(business_id,name,email,phone,password_hash,role) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',
        [businessId,s.userName,email,phone,hash,'owner']
      );
      return {
        id:uResult.rows[0].id,
        business_id:businessId,
        name:s.userName,
        email,
        phone,
        role:'owner'
      };
    });

    // Do NOT return a token — frontend will redirect to login
    res.status(201).json({ok:true, message:'Account created successfully. Please log in with your Gmail and password.'});
  }catch(e){sendError(res,e)}
});

app.post('/api/auth/khata-login',async(req,res)=>{
  try{
    const s=z.object({
      email: z.string().email('Valid email is required'),
      password: z.string().min(1,'Password is required')
    }).parse(req.body);

    const email = s.email.trim().toLowerCase();
    const u = await db.get(`
      SELECT * FROM users 
      WHERE LOWER(email)=LOWER($1)
    `,[email]);

    if(!u){
      return res.status(401).json({error:'No account found with this email. Please sign up.'});
    }

    const matches = await bcrypt.compare(s.password, u.password_hash);
    if(!matches){
      return res.status(401).json({error:'Incorrect password. Please try again or click Forgot Password.'});
    }

    const b=await db.get('SELECT * FROM businesses WHERE id=$1',[u.business_id]);
    const payload={id:u.id,business_id:u.business_id,name:u.name,phone:u.phone,role:u.role||'owner'};
    const token=jwt.sign(payload,SECRET,{expiresIn:'30d'});
    res.json({token,user:payload,business:b});
  }catch(e){sendError(res,e)}
});

app.post('/api/auth/forgot-password',async(req,res)=>{
  try{
    const s=z.object({
      phone: z.string().min(3,'Phone number or Gmail account is required')
    }).parse(req.body);

    const input = s.phone.trim();
    const emailKhata = input.replace(/[^0-9a-zA-Z]/g,'')+'@khata.ai';
    const u=await db.get(`
      SELECT * FROM users 
      WHERE LOWER(phone)=LOWER($1) 
         OR LOWER(email)=LOWER($2) 
         OR LOWER(email)=LOWER($3)
    `,[input, input, emailKhata]);

    if(!u){
      return res.status(404).json({error:'No account found with this phone number or Gmail account. Please check or sign up.'});
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 15 * 60 * 1000; // 15 minutes
    await db.query('UPDATE users SET reset_code=$1, reset_expires=$2 WHERE id=$3',[code, expires, u.id]);
    await audit(u.business_id, u.id, 'REQUEST_PASSWORD_RESET', 'users', u.id, `Reset code generated for ${input}`);

    // Determine if the account was registered with a real email (not @khata.ai internal)
    const isRealEmail = u.email && !u.email.endsWith('@khata.ai') && u.email.includes('@');
    const deliveryEmail = isRealEmail ? u.email : null;

    let emailSent = false;
    if (deliveryEmail) {
      emailSent = await sendResetEmail(deliveryEmail, u.name, code);
    }

    // Build response — only expose the code on screen if no real email delivery happened
    // (i.e. phone-only accounts or if SMTP is not configured)
    const response = {
      ok: true,
      isEmail: !!deliveryEmail,
      emailSent,
      phone: input,
      userName: u.name,
      // If a real email was sent successfully, do NOT send the code back (security)
      // If no email (phone user) or SMTP not configured, show code on screen
      ...(emailSent
        ? { message: `A 6-digit verification code has been sent to your email: ${deliveryEmail.replace(/(.{2}).*(@.*)/, '$1***$2')}` }
        : {
            code,
            message: deliveryEmail
              ? `Email delivery failed — here is your code (configure SMTP in .env to enable email): ${code}`
              : `Your verification code is shown below. Configure SMTP to enable automatic delivery.`
          }
      )
    };

    res.json(response);
  }catch(e){sendError(res,e)}
});

app.post('/api/auth/reset-password',async(req,res)=>{
  try{
    const s=z.object({
      phone: z.string().min(3,'Phone number or Gmail account is required'),
      code: z.string().min(4,'Verification code is required'),
      newPassword: z.string().min(4,'New password must be at least 4 characters')
    }).parse(req.body);

    const input = s.phone.trim();
    const code = s.code.trim();
    const emailKhata = input.replace(/[^0-9a-zA-Z]/g,'')+'@khata.ai';
    const u=await db.get(`
      SELECT * FROM users 
      WHERE LOWER(phone)=LOWER($1) 
         OR LOWER(email)=LOWER($2) 
         OR LOWER(email)=LOWER($3)
    `,[input, input, emailKhata]);

    if(!u){
      return res.status(404).json({error:'No account found with this phone number or Gmail account.'});
    }

    if(!u.reset_code || String(u.reset_code).trim() !== code){
      return res.status(400).json({error:'Incorrect verification code. Please check and enter the 6-digit code.'});
    }

    if(u.reset_expires && Date.now() > Number(u.reset_expires)){
      return res.status(400).json({error:'Verification code has expired. Please request a new code.'});
    }

    const hash = await bcrypt.hash(s.newPassword, 10);
    await db.query('UPDATE users SET password_hash=$1, reset_code=NULL, reset_expires=NULL WHERE id=$2',[hash, u.id]);
    await audit(u.business_id, u.id, 'RESET_PASSWORD_SUCCESS', 'users', u.id, `Password reset successfully for ${input}`);

    res.json({
      ok: true,
      message: 'Password reset successfully! You can now log in with your new password.'
    });
  }catch(e){sendError(res,e)}
});

app.post('/api/auth/register',async(req,res)=>{try{const s=z.object({name:z.string().min(2),email:z.string().email(),password:z.string().min(6),businessName:z.string().min(2),category:z.string().optional(),currency:z.string().default('NPR')}).parse(req.body);const hash=await bcrypt.hash(s.password,12);const user=await withTransaction(async(client)=>{const b=await client.query('INSERT INTO businesses(name,category,currency) VALUES($1,$2,$3) RETURNING id',[s.businessName,s.category||'Retail',s.currency]);const businessId=b.rows[0].id;const u=await client.query('INSERT INTO users(business_id,name,email,password_hash) VALUES($1,$2,$3,$4) RETURNING id',[businessId,s.name,s.email.toLowerCase(),hash]);return{id:u.rows[0].id,business_id:businessId,name:s.name,email:s.email,role:'owner'}});const token=jwt.sign(user,SECRET,{expiresIn:'12h'});res.status(201).json({token,user})}catch(e){sendError(res,e)}});
app.post('/api/auth/login',async(req,res)=>{try{const s=z.object({email:z.string().email(),password:z.string()}).parse(req.body);const u=await db.get('SELECT * FROM users WHERE email=$1',[s.email.toLowerCase()]);if(!u||!(await bcrypt.compare(s.password,u.password_hash)))return res.status(401).json({error:'Email or password is incorrect'});const user={id:u.id,business_id:u.business_id,name:u.name,email:u.email,role:u.role};res.json({token:jwt.sign(user,SECRET,{expiresIn:'12h'}),user})}catch(e){sendError(res,e)}});
app.get('/api/me',auth,async(req,res)=>{try{const b=await db.get('SELECT * FROM businesses WHERE id=$1',[req.user.business_id]);res.json({user:req.user,business:b||{id:req.user.business_id,name:'My Business',currency:'NPR'}})}catch(e){sendError(res,e)}});

// ─── Dashboard ─────────────────────────────────────────────────────────────
app.get('/api/dashboard',auth,async(req,res)=>{
  try{
    const id=biz(req);
    const today=(await db.get("SELECT COALESCE(SUM(total),0) AS v FROM sales WHERE business_id=$1 AND created_at::date=CURRENT_DATE",[id])).v;
    const month=(await db.get("SELECT COALESCE(SUM(total),0) AS v FROM sales WHERE business_id=$1 AND TO_CHAR(created_at,'YYYY-MM')=TO_CHAR(CURRENT_TIMESTAMP,'YYYY-MM')",[id])).v;
    const expenses=(await db.get('SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE business_id=$1',[id])).v;
    const purchases=(await db.get('SELECT COALESCE(SUM(total),0) AS v FROM purchases WHERE business_id=$1',[id])).v;
    const salesChart=await db.all("SELECT TO_CHAR(created_at::date,'YYYY-MM-DD') AS day,COALESCE(SUM(total),0) AS revenue FROM sales WHERE business_id=$1 AND created_at>=NOW()-INTERVAL '6 days' GROUP BY created_at::date ORDER BY day",[id]);
    const recent=await db.all('SELECT * FROM sales WHERE business_id=$1 ORDER BY id DESC LIMIT 5',[id]);
    const stock=await db.get('SELECT COUNT(*) AS total,COALESCE(SUM(stock),0) AS units,COALESCE(SUM(stock*purchase_price),0) AS value,COALESCE(SUM(CASE WHEN stock<=min_stock THEN 1 ELSE 0 END),0) AS low FROM products WHERE business_id=$1 AND archived=0',[id]);
    const low=await db.all('SELECT id,name,stock,min_stock FROM products WHERE business_id=$1 AND archived=0 AND stock<=min_stock ORDER BY stock LIMIT 5',[id]);
    res.json({today,month,expenses,purchases,netProfit:month-expenses-purchases,receivables:0,payables:0,stock,sales:salesChart,low,recent});
  }catch(e){sendError(res,e)}
});

// ─── Generic CRUD (products, customers, suppliers, expenses) ───────────────
const resources={
  products:{table:'products',fields:['sku','name','category','unit','purchase_price','selling_price','stock','min_stock'],required:['name']},
  customers:{table:'customers',fields:['name','phone','email','address'],required:['name']},
  suppliers:{table:'suppliers',fields:['name','contact','phone','email','address','payment_terms'],required:['name']},
  expenses:{table:'expenses',fields:['category','description','amount','date'],required:['category','amount']}
};
for(const [key,cfg] of Object.entries(resources)){
  app.get('/api/'+key,auth,async(req,res)=>{
    try{
      const rows=await db.all(`SELECT * FROM ${cfg.table} WHERE business_id=$1 ${key==='products'?'AND archived=0':''} ORDER BY id DESC`,[biz(req)]);
      res.json(rows);
    }catch(e){sendError(res,e)}
  });
  app.post('/api/'+key,auth,async(req,res)=>{try{
    const data={};
    for(const f of cfg.fields)if(req.body[f]!==undefined)data[f]=req.body[f];
    for(const f of cfg.required)if(data[f]===undefined||data[f]==='')throw Error(`${f} is required`);
    if(['amount','purchase_price','selling_price','stock','min_stock'].some(f=>f in data)){
      for(const f of ['amount','purchase_price','selling_price','stock','min_stock'])
        if(f in data){const n=Number(data[f]);if(!Number.isFinite(n)||n<0)throw Error(`${f} must be a non-negative number`);data[f]=n}
    }
    const cols=Object.keys(data);
    const placeholders=cols.map((_,idx)=>'$'+(idx+2)).join(',');
    const inserted=await db.get(`INSERT INTO ${cfg.table}(business_id,${cols.join(',')}) VALUES($1,${placeholders}) RETURNING *`,[biz(req),...cols.map(k=>data[k])]);
    await audit(biz(req),req.user.id,'create',key,inserted.id);
    if(key==='expenses'){
      const expenseCsvLine=[inserted.id,`"${data.category}"`,`"${data.description||''}"`,data.amount,`"${data.date||''}"`,`"${new Date().toISOString()}"`].join(',');
      try{fs.appendFileSync(path.join(uploadsDir,'expenses.csv'),expenseCsvLine+'\n');}catch(e){}
    }
    res.status(201).json(inserted);
  }catch(e){sendError(res,e)}});
  app.put('/api/'+key+'/:id',auth,async(req,res)=>{try{
    const fields=cfg.fields.filter(f=>req.body[f]!==undefined);
    if(!fields.length)throw Error('No fields to update');
    const setClause=fields.map((f,idx)=>`${f}=$${idx+1}`).join(',');
    const updated=await db.get(`UPDATE ${cfg.table} SET ${setClause} WHERE id=$${fields.length+1} AND business_id=$${fields.length+2} RETURNING *`,[...fields.map(f=>req.body[f]),req.params.id,biz(req)]);
    res.json(updated);
  }catch(e){sendError(res,e)}});
  app.delete('/api/'+key+'/:id',auth,async(req,res)=>{
    try{
      if(key==='products') await db.query('UPDATE products SET archived=1 WHERE id=$1 AND business_id=$2',[req.params.id,biz(req)]);
      else await db.query(`DELETE FROM ${cfg.table} WHERE id=$1 AND business_id=$2`,[req.params.id,biz(req)]);
      res.json({ok:true});
    }catch(e){sendError(res,e)}
  });
}

// ─── SALES (free-text, no dropdowns) ──────────────────────────────────────
app.get('/api/sales',auth,async(req,res)=>{
  try{
    res.json(await db.all('SELECT * FROM sales WHERE business_id=$1 ORDER BY id DESC',[biz(req)]));
  }catch(e){sendError(res,e)}
});

app.post('/api/sales',auth,async(req,res)=>{try{
  const s=z.object({
    customer_name: z.string().optional().default(''),
    product_name:  z.string().min(1,'Product name is required'),
    price:         z.coerce.number().nonnegative(),
    discount:      z.coerce.number().nonnegative().default(0),
    purchase_price:z.coerce.number().nonnegative().default(0),
    remarks:       z.string().optional().default(''),
    quantity:      z.coerce.number().positive().default(1),
  }).parse(req.body);
  const total=(s.price - s.discount) * s.quantity;
  const invoice='INV-'+Date.now();
  const r=await db.get('INSERT INTO sales(business_id,invoice_no,customer_name,product_name,price,discount,purchase_price,remarks,total) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',[biz(req),invoice,s.customer_name,s.product_name,s.price,s.discount,s.purchase_price,s.remarks,total]);
  // Append sale to CSV for instant Excel view
  const saleCsvLine = [
    r.id,
    `"${invoice}"`,
    `"${s.customer_name||''}"`,
    `"${s.product_name}"`,
    s.price,
    s.discount,
    s.purchase_price,
    total,
    `"${s.remarks||''}"`,
    `"${new Date().toISOString()}"`
  ].join(',');
  fs.appendFileSync(path.join(uploadsDir, 'sales.csv'), saleCsvLine + '\n');
  await audit(biz(req),req.user.id,'create','sale',r.id,invoice);
  res.status(201).json({id:r.id,invoice_no:invoice,total,product_name:s.product_name,customer_name:s.customer_name});
}catch(e){sendError(res,e)}});

app.delete('/api/sales/:id',auth,async(req,res)=>{
  try{
    await db.query('DELETE FROM sales WHERE id=$1 AND business_id=$2',[req.params.id,biz(req)]);
    res.json({ok:true});
  }catch(e){sendError(res,e)}
});

// Excel export for sales
app.get('/api/sales/export',auth,async(req,res)=>{
  try{
    const rows=await db.all('SELECT * FROM sales WHERE business_id=$1 ORDER BY id DESC',[biz(req)]);
    const header=['ID','Invoice No','Customer Name','Product Name','Price','Discount','Purchase Price','Total','Remarks','Date'];
    const csv=[header.join(','),...rows.map(r=>[
      r.id,`"${r.invoice_no}"`,`"${r.customer_name||''}"`,`"${r.product_name||''}"`,
      r.price,r.discount,r.purchase_price,r.total,`"${r.remarks||''}"`,`"${r.created_at}"`
    ].join(','))].join('\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition','attachment; filename="sales.csv"');
    res.send(csv);
  }catch(e){sendError(res,e)}
});

// ─── PURCHASES (free-text, no dropdowns) ──────────────────────────────────
app.get('/api/purchases',auth,async(req,res)=>{
  try{
    res.json(await db.all('SELECT * FROM purchases WHERE business_id=$1 ORDER BY id DESC',[biz(req)]));
  }catch(e){sendError(res,e)}
});

app.post('/api/purchases',auth,async(req,res)=>{try{
  const s=z.object({
    supplier:      z.string().min(1,'Supplier name is required'),
    product:       z.string().min(1,'Product name is required'),
    quantity:      z.coerce.number().positive(),
    unit_cost:     z.coerce.number().nonnegative(),
    expected_date: z.string().optional().default(''),
  }).parse(req.body);
  const total=s.quantity*s.unit_cost;
  const po='PO-'+Date.now();
  const r=await db.get('INSERT INTO purchases(business_id,supplier,product,quantity,unit_cost,total,expected_date,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[biz(req),s.supplier,s.product,s.quantity,s.unit_cost,total,s.expected_date,'Order placed']);
  // Append purchase to CSV for instant Excel view
  const purchaseCsvLine = [
    r.id,
    `"${s.supplier}"`,
    `"${s.product}"`,
    s.quantity,
    s.unit_cost,
    total,
    `"${s.expected_date||''}"`,
    `"Order placed"`,
    `"${new Date().toISOString()}"`
  ].join(',');
  fs.appendFileSync(path.join(uploadsDir, 'purchases.csv'), purchaseCsvLine + '\n');
  await audit(biz(req),req.user.id,'create','purchase',r.id,po);
  res.status(201).json({id:r.id,supplier:s.supplier,product:s.product,total,status:'Order placed'});
}catch(e){sendError(res,e)}});

app.delete('/api/purchases/:id',auth,async(req,res)=>{
  try{
    await db.query('DELETE FROM purchases WHERE id=$1 AND business_id=$2',[req.params.id,biz(req)]);
    res.json({ok:true});
  }catch(e){sendError(res,e)}
});

// Excel export for purchases
app.get('/api/purchases/export',auth,async(req,res)=>{
  try{
    const rows=await db.all('SELECT * FROM purchases WHERE business_id=$1 ORDER BY id DESC',[biz(req)]);
    const header=['ID','Supplier','Product','Quantity','Unit Cost','Total','Status','Expected Date','Date'];
    const csv=[header.join(','),...rows.map(r=>[
      r.id,`"${r.supplier||''}"`,`"${r.product||''}"`,r.quantity,r.unit_cost,r.total,
      `"${r.status}"`,`"${r.expected_date||''}"`,`"${r.created_at}"`
    ].join(','))].join('\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition','attachment; filename="purchases.csv"');
    res.send(csv);
  }catch(e){sendError(res,e)}
});

// ─── PAYMENTS (no "income" type) ──────────────────────────────────────────
app.get('/api/payments',auth,async(req,res)=>{
  try{
    res.json(await db.all('SELECT * FROM payments WHERE business_id=$1 ORDER BY id DESC',[biz(req)]));
  }catch(e){sendError(res,e)}
});

app.post('/api/payments',auth,async(req,res)=>{try{
  const p=z.object({
    type:   z.enum(['expense','supplier_payment','customer_payment']),
    amount: z.coerce.number().positive(),
    method: z.string().default('Cash'),
    note:   z.string().optional().default(''),
  }).parse(req.body);
  const r=await db.get('INSERT INTO payments(business_id,type,amount,method,note) VALUES($1,$2,$3,$4,$5) RETURNING id',[biz(req),p.type,p.amount,p.method,p.note]);
  // Append payment to CSV for instant Excel view
  const paymentCsvLine = [
    r.id,
    `"${p.type}"`,
    p.amount,
    `"${p.method}"`,
    `"${p.note||''}"`,
    `"${new Date().toISOString()}"`
  ].join(',');
  fs.appendFileSync(path.join(uploadsDir, 'payments.csv'), paymentCsvLine + '\n');
  await audit(biz(req),req.user.id,'create','payment',r.id);
  res.status(201).json({id:r.id});
}catch(e){sendError(res,e)}});

app.delete('/api/payments/:id',auth,async(req,res)=>{
  try{
    await db.query('DELETE FROM payments WHERE id=$1 AND business_id=$2',[req.params.id,biz(req)]);
    res.json({ok:true});
  }catch(e){sendError(res,e)}
});

// ─── INVOICE UPLOAD ────────────────────────────────────────────────────────
app.post('/api/invoices/upload',auth,upload.single('invoice'),async(req,res)=>{try{
  if(!req.file)return res.status(400).json({error:'No file uploaded. Accepted: JPG, PNG, PDF up to 10 MB.'});
  const notes=req.body.notes||'';
  const customer=req.body.customer_name||'';
  const product=req.body.product_name||req.file.originalname;
  const amount=Number(req.body.amount||req.body.price||0);
  const r=await db.get('INSERT INTO invoice_uploads(business_id,filename,original_name,mime_type,size,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[biz(req),req.file.filename,req.file.originalname,req.file.mimetype,req.file.size,notes]);
  
  // 1. Record to invoices.csv
  const invCsvLine=[r.id,`"${req.file.filename}"`,`"${req.file.originalname}"`,`"${req.file.mimetype}"`,req.file.size,`"${notes.replace(/"/g,'""')}"`,'uploaded',`"${new Date().toISOString()}"`].join(',');
  try{fs.appendFileSync(path.join(uploadsDir,'invoices.csv'),invCsvLine+'\n');}catch(e){}

  // 2. Automatically record this invoice as a sale directly in sales & sales.csv
  const invoiceNo='INV-'+Date.now();
  const saleTotal=amount>0?amount:0;
  const saleR=await db.get('INSERT INTO sales(business_id,invoice_no,customer_name,product_name,price,discount,purchase_price,remarks,total) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',[biz(req),invoiceNo,customer,product,saleTotal,0,0,notes||`From invoice: ${req.file.originalname}`,saleTotal]);
  await audit(biz(req),req.user.id,'create','sale',saleR.id,invoiceNo);
  const saleCsvLine=[saleR.id,`"${invoiceNo}"`,`"${customer}"`,`"${product}"`,saleTotal,0,0,saleTotal,`"Invoice: ${req.file.originalname}"`,`"${new Date().toISOString()}"`].join(',');
  try{fs.appendFileSync(path.join(uploadsDir,'sales.csv'),saleCsvLine+'\n');}catch(e){}

  res.status(201).json({id:r.id,filename:req.file.filename,original_name:req.file.originalname,url:'/uploads/'+req.file.filename,status:'uploaded',invoice_no:invoiceNo,sale_id:saleR.id,total:saleTotal});
}catch(e){sendError(res,e)}});

app.get('/api/invoices',auth,async(req,res)=>{
  try{
    res.json(await db.all('SELECT * FROM invoice_uploads WHERE business_id=$1 ORDER BY id DESC',[biz(req)]));
  }catch(e){sendError(res,e)}
});

app.get('/api/invoices/export',auth,async(req,res)=>{
  try{
    const rows=await db.all('SELECT * FROM invoice_uploads WHERE business_id=$1 ORDER BY id DESC',[biz(req)]);
    const header=['ID','Filename','Original Name','MIME Type','Size (Bytes)','Notes','Status','Date'];
    const csv=[header.join(','),...rows.map(r=>[
      r.id,`"${r.filename}"`,`"${(r.original_name||'').replace(/"/g,'""')}"`,`"${r.mime_type}"`,
      r.size,`"${(r.notes||'').replace(/"/g,'""')}"`,`"${r.status}"`,`"${r.created_at}"`
    ].join(','))].join('\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition','attachment; filename="invoices.csv"');
    res.send(csv);
  }catch(e){sendError(res,e)}
});

app.get('/api/expenses/export',auth,async(req,res)=>{
  try{
    const rows=await db.all('SELECT * FROM expenses WHERE business_id=$1 ORDER BY id DESC',[biz(req)]);
    const header=['ID','Category','Description','Amount','Date'];
    const csv=[header.join(','),...rows.map(r=>[
      r.id,`"${(r.category||'').replace(/"/g,'""')}"`,`"${(r.description||'').replace(/"/g,'""')}"`,r.amount,`"${r.date}"`
    ].join(','))].join('\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition','attachment; filename="expenses.csv"');
    res.send(csv);
  }catch(e){sendError(res,e)}
});

app.get('/api/payments/export',auth,async(req,res)=>{
  try{
    const rows=await db.all('SELECT * FROM payments WHERE business_id=$1 ORDER BY id DESC',[biz(req)]);
    const header=['ID','Type','Amount','Method','Note','Date'];
    const csv=[header.join(','),...rows.map(r=>[
      r.id,`"${r.type}"`,r.amount,`"${(r.method||'').replace(/"/g,'""')}"`,`"${(r.note||'').replace(/"/g,'""')}"`,`"${r.created_at}"`
    ].join(','))].join('\n');
    res.setHeader('Content-Type','text/csv');
    res.setHeader('Content-Disposition','attachment; filename="payments.csv"');
    res.send(csv);
  }catch(e){sendError(res,e)}
});

app.delete('/api/invoices/:id',auth,async(req,res)=>{
  try{
    const inv=await db.get('SELECT * FROM invoice_uploads WHERE id=$1 AND business_id=$2',[req.params.id,biz(req)]);
    if(inv){
      try{fs.unlinkSync(path.join(uploadsDir,inv.filename))}catch(e){}
      await db.query('DELETE FROM invoice_uploads WHERE id=$1',[inv.id]);
    }
    res.json({ok:true});
  }catch(e){sendError(res,e)}
});

// ─── NOTIFICATIONS ─────────────────────────────────────────────────────────
app.get('/api/notifications',auth,async(req,res)=>{try{res.json(await db.all('SELECT * FROM notifications WHERE business_id=$1 ORDER BY id DESC LIMIT 100',[biz(req)]))}catch(e){sendError(res,e)}});
app.put('/api/notifications/:id/read',auth,async(req,res)=>{try{await db.query('UPDATE notifications SET read=1 WHERE id=$1 AND business_id=$2',[req.params.id,biz(req)]);res.json({ok:true})}catch(e){sendError(res,e)}});

// ─── REPORTS ───────────────────────────────────────────────────────────────
app.get('/api/reports',auth,async(req,res)=>{
  try{
    const id=biz(req);
    res.json({
      sales:await db.get('SELECT COUNT(*) AS count,COALESCE(SUM(total),0) AS revenue,COALESCE(SUM(purchase_price),0) AS cogs,COALESCE(SUM(total),0) AS collected FROM sales WHERE business_id=$1',[id]),
      expenses:(await db.get('SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE business_id=$1',[id])).total,
      purchases:(await db.get('SELECT COALESCE(SUM(total),0) AS total FROM purchases WHERE business_id=$1',[id])).total,
      inventory:await db.get('SELECT COUNT(*) AS products,COALESCE(SUM(stock*purchase_price),0) AS value FROM products WHERE business_id=$1 AND archived=0',[id]),
      receivables:0,payables:0
    });
  }catch(e){sendError(res,e)}
});

// ─── SETTINGS ──────────────────────────────────────────────────────────────
app.get('/api/settings',auth,async(req,res)=>{try{res.json(await db.get('SELECT * FROM businesses WHERE id=$1',[biz(req)]))}catch(e){sendError(res,e)}});
app.put('/api/settings',auth,async(req,res)=>{
  try{
    const {name,category,currency,address}=req.body;
    const updated=await db.get('UPDATE businesses SET name=COALESCE($1,name),category=COALESCE($2,category),currency=COALESCE($3,currency),address=COALESCE($4,address) WHERE id=$5 RETURNING *',[name,category,currency,address,biz(req)]);
    res.json(updated);
  }catch(e){sendError(res,e)}
});

// ─── Production static serve ───────────────────────────────────────────────
const dist=path.resolve(__dirname,'../../frontend/dist');
if(process.env.NODE_ENV==='production'){app.use(express.static(dist));app.get('*',(req,res)=>res.sendFile(path.join(dist,'index.html')))}

let server;
async function start(){
  try{
    await initDb();
    console.log('✅ PostgreSQL connected and schema verified');
    server=app.listen(PORT,()=>console.log(`BusinessOps API listening on http://localhost:${PORT}`));
  }catch(err){
    console.error('❌ Failed to initialize PostgreSQL database:',err.message);
    process.exit(1);
  }
}

async function shutdown(signal){
  console.log(`\n${signal} received. Shutting down gracefully...`);
  if(server){
    await new Promise((resolve)=>server.close(resolve));
  }
  await closeDb();
  process.exit(0);
}

process.on('SIGINT',()=>shutdown('SIGINT'));
process.on('SIGTERM',()=>shutdown('SIGTERM'));

start();
