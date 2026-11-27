import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {z} from 'zod';
import {createRequire} from 'node:module';
import {q, one, tx, audit, initDb} from './db.js';

dotenv.config({path:path.resolve(process.cwd(),'../.env')});
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(import.meta.url);
const multer=require('multer');

const app=express(), PORT=process.env.PORT||4000, SECRET=process.env.JWT_SECRET||'local-development-secret-change-me';
app.set('trust proxy',1); // Render sits behind a proxy

// Upload storage (note: on Render free plan these files are wiped on every restart)
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
app.use(cors({origin:process.env.CORS_ORIGIN?.split(',').map(s=>s.trim())||true}));
app.use(express.json({limit:'4mb'}));
app.use(rateLimit({windowMs:60000,limit:300,standardHeaders:true,legacyHeaders:false}));

app.use('/uploads',express.static(uploadsDir));

// ─── Helpers ───────────────────────────────────────────────────────────────
const TZ=`'Asia/Kathmandu'`;
const auth=(req,res,next)=>{
  const token=req.headers.authorization?.replace(/^Bearer /,'');
  if(!token){req.user={id:null,business_id:1,role:'owner',name:'Workspace Owner'};return next()}
  try{req.user=jwt.verify(token,SECRET);next()}
  catch{return res.status(401).json({error:'Session expired. Please sign in again.'})}
};
const sendError=(res,e)=>{
  if(e?.code==='23505') return res.status(409).json({error:'This record already exists'});
  if(!e?.issues) console.error(e);
  res.status(e.status||400).json({error:e.issues?.[0]?.message||e.message||'Request failed'});
};
// Wraps async routes so any error becomes a clean JSON response
const wrap=fn=>(req,res)=>Promise.resolve(fn(req,res)).catch(e=>sendError(res,e));
const biz=req=>req.user.business_id;
const cell=v=>`"${String(v??'').replace(/"/g,'""')}"`;
const iso=d=>d instanceof Date?d.toISOString():(d||'');
const appendCsv=(file,line)=>{try{fs.appendFileSync(path.join(uploadsDir,file),line+'\n')}catch(e){}};

// ─── Health (really checks the database) ───────────────────────────────────
app.get('/api/health',wrap(async(req,res)=>{
  await q('SELECT 1');
  res.json({ok:true,service:'BusinessOps AI API',database:'connected'});
}));

// ─── Auth (original) ───────────────────────────────────────────────────────
app.post('/api/auth/register',wrap(async(req,res)=>{
  const s=z.object({name:z.string().min(2),email:z.string().email(),password:z.string().min(8),businessName:z.string().min(2),category:z.string().optional(),currency:z.string().default('NPR')}).parse(req.body);
  const email=s.email.toLowerCase();
  const hash=await bcrypt.hash(s.password,12);
  const user=await tx(async c=>{
    const b=(await c.query('INSERT INTO businesses(name,category,currency) VALUES($1,$2,$3) RETURNING id',[s.businessName,s.category||'Retail',s.currency])).rows[0];
    const u=(await c.query('INSERT INTO users(business_id,name,email,password_hash) VALUES($1,$2,$3,$4) RETURNING id',[b.id,s.name,email,hash])).rows[0];
    return {id:u.id,business_id:b.id,name:s.name,email,role:'owner'};
  });
  res.status(201).json({token:jwt.sign(user,SECRET,{expiresIn:'12h'}),user});
}));

app.post('/api/auth/login',wrap(async(req,res)=>{
  const s=z.object({email:z.string().email(),password:z.string()}).parse(req.body);
  const u=await one('SELECT * FROM users WHERE email=$1',[s.email.toLowerCase()]);
  if(!u||!(await bcrypt.compare(s.password,u.password_hash)))return res.status(401).json({error:'Email or password is incorrect'});
  const user={id:u.id,business_id:u.business_id,name:u.name,email:u.email,role:u.role};
  res.json({token:jwt.sign(user,SECRET,{expiresIn:'12h'}),user});
}));

// ─── Khata AI auth routes (match frontend) ─────────────────────────────────
app.post('/api/auth/khata-signup',wrap(async(req,res)=>{
  const s=z.object({
    userName:z.string().trim().min(2,'Name is too short'),
    businessName:z.string().trim().min(2,'Business name is too short'),
    address:z.string().optional().default(''),
    phone:z.string().trim().optional().default(''),
    email:z.string().trim().email('Enter a valid Gmail'),
    password:z.string().min(6,'Password must be at least 6 characters')
  }).parse(req.body);
  const email=s.email.toLowerCase();
  if(await one('SELECT id FROM users WHERE email=$1',[email]))
    return res.status(409).json({error:'An account with this Gmail already exists'});
  const hash=await bcrypt.hash(s.password,12);
  await tx(async c=>{
    const b=(await c.query('INSERT INTO businesses(name,category,currency,address,phone) VALUES($1,$2,$3,$4,$5) RETURNING id',[s.businessName,'Retail','NPR',s.address,s.phone])).rows[0];
    await c.query('INSERT INTO users(business_id,name,email,password_hash,phone) VALUES($1,$2,$3,$4,$5)',[b.id,s.userName,email,hash,s.phone]);
  });
  res.status(201).json({ok:true});
}));

app.post('/api/auth/khata-login',wrap(async(req,res)=>{
  const s=z.object({email:z.string().trim().email('Enter a valid Gmail'),password:z.string().min(1,'Enter your password')}).parse(req.body);
  const u=await one('SELECT * FROM users WHERE email=$1',[s.email.toLowerCase()]);
  if(!u||!(await bcrypt.compare(s.password,u.password_hash)))
    return res.status(401).json({error:'Gmail or password is incorrect'});
  const user={id:u.id,business_id:u.business_id,name:u.name,email:u.email,role:u.role,phone:u.phone};
  const business=await one('SELECT * FROM businesses WHERE id=$1',[u.business_id]);
  res.json({token:jwt.sign(user,SECRET,{expiresIn:'12h'}),user,business});
}));

// Finds a user by Gmail or phone number (the frontend sends either in the "phone" field)
const findUserForReset=raw=>{
  const v=String(raw||'').trim();
  return one('SELECT * FROM users WHERE LOWER(email)=$1 OR phone=$2 LIMIT 1',[v.toLowerCase(),v]);
};

// NOTE: returns the code in the response because email sending is not set up yet.
// Fine for testing; replace with real email delivery before real users sign up.
app.post('/api/auth/forgot-password',wrap(async(req,res)=>{
  if(!String(req.body.phone||'').trim()) return res.status(400).json({error:'Please enter your Gmail or phone number'});
  const u=await findUserForReset(req.body.phone);
  if(!u) return res.status(404).json({error:'No account found with this Gmail or phone number'});
  const code=String(Math.floor(100000+Math.random()*900000));
  await q('UPDATE users SET reset_code=$1, reset_expires=$2 WHERE id=$3',[code,Date.now()+10*60*1000,u.id]);
  res.json({message:'Verification code generated',isEmail:String(req.body.phone).includes('@'),emailSent:false,code});
}));

app.post('/api/auth/reset-password',wrap(async(req,res)=>{
  const u=await findUserForReset(req.body.phone);
  const code=String(req.body.code||'').trim();
  if(!u||!u.reset_code||u.reset_code!==code||Date.now()>Number(u.reset_expires))
    return res.status(400).json({error:'Invalid or expired code'});
  if(String(req.body.newPassword||'').length<6) throw Error('Password must be at least 6 characters');
  const hash=await bcrypt.hash(req.body.newPassword,12);
  await q("UPDATE users SET password_hash=$1, reset_code='', reset_expires=0 WHERE id=$2",[hash,u.id]);
  res.json({ok:true});
}));

app.get('/api/me',auth,wrap(async(req,res)=>{
  const b=await one('SELECT * FROM businesses WHERE id=$1',[req.user.business_id]);
  res.json({user:req.user,business:b||{id:1,name:'My Business',currency:'NPR'}});
}));

// ─── Dashboard (dates use Nepal time) ──────────────────────────────────────
app.get('/api/dashboard',auth,wrap(async(req,res)=>{
  const id=biz(req);
  const [t,m,e,p,salesChart,recent,stock,low]=await Promise.all([
    one(`SELECT COALESCE(SUM(total),0) v FROM sales WHERE business_id=$1 AND (created_at AT TIME ZONE ${TZ})::date=(now() AT TIME ZONE ${TZ})::date`,[id]),
    one(`SELECT COALESCE(SUM(total),0) v FROM sales WHERE business_id=$1 AND date_trunc('month',created_at AT TIME ZONE ${TZ})=date_trunc('month',now() AT TIME ZONE ${TZ})`,[id]),
    one('SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE business_id=$1',[id]),
    one('SELECT COALESCE(SUM(total),0) v FROM purchases WHERE business_id=$1',[id]),
    q(`SELECT to_char((created_at AT TIME ZONE ${TZ})::date,'YYYY-MM-DD') AS day, SUM(total) AS revenue FROM sales WHERE business_id=$1 AND created_at>=now()-interval '6 days' GROUP BY 1 ORDER BY 1`,[id]),
    q('SELECT * FROM sales WHERE business_id=$1 ORDER BY id DESC LIMIT 5',[id]),
    one('SELECT COUNT(*) total,COALESCE(SUM(stock),0) units,COALESCE(SUM(stock*purchase_price),0) value,COALESCE(SUM(CASE WHEN stock<=min_stock THEN 1 ELSE 0 END),0) low FROM products WHERE business_id=$1 AND archived=0',[id]),
    q('SELECT id,name,stock,min_stock FROM products WHERE business_id=$1 AND archived=0 AND stock<=min_stock ORDER BY stock LIMIT 5',[id])
  ]);
  const today=t.v, month=m.v, expenses=e.v, purchases=p.v;
  res.json({today,month,expenses,purchases,netProfit:month-expenses-purchases,receivables:0,payables:0,stock,sales:salesChart,low,recent});
}));

// ─── Generic CRUD (products, customers, suppliers, expenses) ───────────────
const resources={
  products:{table:'products',fields:['sku','name','category','unit','purchase_price','selling_price','stock','min_stock'],required:['name']},
  customers:{table:'customers',fields:['name','phone','email','address'],required:['name']},
  suppliers:{table:'suppliers',fields:['name','contact','phone','email','address','payment_terms'],required:['name']},
  expenses:{table:'expenses',fields:['category','description','amount','date'],required:['category','amount']}
};
const NUMERIC_FIELDS=['amount','purchase_price','selling_price','stock','min_stock'];
for(const [key,cfg] of Object.entries(resources)){
  app.get('/api/'+key,auth,wrap(async(req,res)=>{
    res.json(await q(`SELECT * FROM ${cfg.table} WHERE business_id=$1 ${key==='products'?'AND archived=0':''} ORDER BY id DESC`,[biz(req)]));
  }));
  app.post('/api/'+key,auth,wrap(async(req,res)=>{
    const data={};
    for(const f of cfg.fields)if(req.body[f]!==undefined)data[f]=req.body[f];
    for(const f of cfg.required)if(data[f]===undefined||data[f]==='')throw Error(`${f} is required`);
    for(const f of NUMERIC_FIELDS)
      if(f in data){const n=Number(data[f]);if(!Number.isFinite(n)||n<0)throw Error(`${f} must be a non-negative number`);data[f]=n}
    const cols=Object.keys(data);
    const ph=cols.map((_,i)=>'$'+(i+2)).join(',');
    const row=await one(`INSERT INTO ${cfg.table}(business_id,${cols.join(',')}) VALUES($1,${ph}) RETURNING *`,[biz(req),...cols.map(k=>data[k])]);
    audit(biz(req),req.user.id,'create',key,row.id);
    res.status(201).json(row);
  }));
  app.put('/api/'+key+'/:id',auth,wrap(async(req,res)=>{
    const fields=cfg.fields.filter(f=>req.body[f]!==undefined);
    if(!fields.length)throw Error('No fields to update');
    const n=fields.length;
    const row=await one(`UPDATE ${cfg.table} SET ${fields.map((f,i)=>`${f}=$${i+1}`).join(',')} WHERE id=$${n+1} AND business_id=$${n+2} RETURNING *`,[...fields.map(f=>req.body[f]),req.params.id,biz(req)]);
    res.json(row||{});
  }));
  app.delete('/api/'+key+'/:id',auth,wrap(async(req,res)=>{
    if(key==='products') await q('UPDATE products SET archived=1 WHERE id=$1 AND business_id=$2',[req.params.id,biz(req)]);
    else await q(`DELETE FROM ${cfg.table} WHERE id=$1 AND business_id=$2`,[req.params.id,biz(req)]);
    res.json({ok:true});
  }));
}

// ─── SALES ─────────────────────────────────────────────────────────────────
app.get('/api/sales',auth,wrap(async(req,res)=>{
  res.json(await q('SELECT * FROM sales WHERE business_id=$1 ORDER BY id DESC',[biz(req)]));
}));

app.post('/api/sales',auth,wrap(async(req,res)=>{
  const s=z.object({
    customer_name: z.string().optional().default(''),
    product_name:  z.string().min(1,'Product name is required'),
    price:         z.coerce.number().nonnegative(),
    discount:      z.coerce.number().nonnegative().default(0),
    purchase_price:z.coerce.number().nonnegative().default(0),
    remarks:       z.string().optional().default(''),
    quantity:      z.coerce.number().positive().default(1),
  }).parse(req.body);
  const total=(s.price-s.discount)*s.quantity;
  const invoice='INV-'+Date.now();
  const r=await one('INSERT INTO sales(business_id,invoice_no,customer_name,product_name,price,discount,purchase_price,quantity,remarks,total) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id',[biz(req),invoice,s.customer_name,s.product_name,s.price,s.discount,s.purchase_price,s.quantity,s.remarks,total]);
  appendCsv('sales.csv',[r.id,cell(invoice),cell(s.customer_name),cell(s.product_name),s.price,s.discount,s.purchase_price,total,cell(s.remarks),cell(new Date().toISOString())].join(','));
  audit(biz(req),req.user.id,'create','sale',r.id,invoice);
  res.status(201).json({id:r.id,invoice_no:invoice,total,product_name:s.product_name,customer_name:s.customer_name});
}));

app.delete('/api/sales/:id',auth,wrap(async(req,res)=>{
  await q('DELETE FROM sales WHERE id=$1 AND business_id=$2',[req.params.id,biz(req)]);
  res.json({ok:true});
}));

app.get('/api/sales/export',auth,wrap(async(req,res)=>{
  const rows=await q('SELECT * FROM sales WHERE business_id=$1 ORDER BY id DESC',[biz(req)]);
  const header=['ID','Invoice No','Customer Name','Product Name','Price','Discount','Purchase Price','Total','Remarks','Date'];
  const csv=[header.join(','),...rows.map(r=>[
    r.id,cell(r.invoice_no),cell(r.customer_name),cell(r.product_name),
    r.price,r.discount,r.purchase_price,r.total,cell(r.remarks),cell(iso(r.created_at))
  ].join(','))].join('\n');
  res.setHeader('Content-Type','text/csv');
  res.setHeader('Content-Disposition','attachment; filename="sales.csv"');
  res.send(csv);
}));

// ─── PURCHASES ─────────────────────────────────────────────────────────────
app.get('/api/purchases',auth,wrap(async(req,res)=>{
  res.json(await q('SELECT * FROM purchases WHERE business_id=$1 ORDER BY id DESC',[biz(req)]));
}));

app.post('/api/purchases',auth,wrap(async(req,res)=>{
  const s=z.object({
    supplier:      z.string().min(1,'Supplier name is required'),
    product:       z.string().min(1,'Product name is required'),
    quantity:      z.coerce.number().positive(),
    unit_cost:     z.coerce.number().nonnegative(),
    expected_date: z.string().optional().default(''),
  }).parse(req.body);
  const total=s.quantity*s.unit_cost;
  const po='PO-'+Date.now();
  const r=await one('INSERT INTO purchases(business_id,supplier,product,quantity,unit_cost,total,expected_date,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[biz(req),s.supplier,s.product,s.quantity,s.unit_cost,total,s.expected_date,'Order placed']);
  appendCsv('purchases.csv',[r.id,cell(s.supplier),cell(s.product),s.quantity,s.unit_cost,total,cell(s.expected_date),cell('Order placed'),cell(new Date().toISOString())].join(','));
  audit(biz(req),req.user.id,'create','purchase',r.id,po);
  res.status(201).json({id:r.id,supplier:s.supplier,product:s.product,total,status:'Order placed'});
}));

app.delete('/api/purchases/:id',auth,wrap(async(req,res)=>{
  await q('DELETE FROM purchases WHERE id=$1 AND business_id=$2',[req.params.id,biz(req)]);
  res.json({ok:true});
}));

app.get('/api/purchases/export',auth,wrap(async(req,res)=>{
  const rows=await q('SELECT * FROM purchases WHERE business_id=$1 ORDER BY id DESC',[biz(req)]);
  const header=['ID','Supplier','Product','Quantity','Unit Cost','Total','Status','Expected Date','Date'];
  const csv=[header.join(','),...rows.map(r=>[
    r.id,cell(r.supplier),cell(r.product),r.quantity,r.unit_cost,r.total,
    cell(r.status),cell(r.expected_date),cell(iso(r.created_at))
  ].join(','))].join('\n');
  res.setHeader('Content-Type','text/csv');
  res.setHeader('Content-Disposition','attachment; filename="purchases.csv"');
  res.send(csv);
}));

// ─── PAYMENTS ──────────────────────────────────────────────────────────────
app.get('/api/payments',auth,wrap(async(req,res)=>{
  res.json(await q('SELECT * FROM payments WHERE business_id=$1 ORDER BY id DESC',[biz(req)]));
}));

app.post('/api/payments',auth,wrap(async(req,res)=>{
  const p=z.object({
    type:   z.enum(['expense','supplier_payment','customer_payment']),
    amount: z.coerce.number().positive(),
    method: z.string().default('Cash'),
    note:   z.string().optional().default(''),
  }).parse(req.body);
  const r=await one('INSERT INTO payments(business_id,type,amount,method,note) VALUES($1,$2,$3,$4,$5) RETURNING id',[biz(req),p.type,p.amount,p.method,p.note]);
  appendCsv('payments.csv',[r.id,cell(p.type),p.amount,cell(p.method),cell(p.note),cell(new Date().toISOString())].join(','));
  audit(biz(req),req.user.id,'create','payment',r.id);
  res.status(201).json({id:r.id});
}));

app.delete('/api/payments/:id',auth,wrap(async(req,res)=>{
  await q('DELETE FROM payments WHERE id=$1 AND business_id=$2',[req.params.id,biz(req)]);
  res.json({ok:true});
}));

// ─── INVOICE UPLOAD ────────────────────────────────────────────────────────
app.post('/api/invoices/upload',auth,upload.single('invoice'),wrap(async(req,res)=>{
  if(!req.file)return res.status(400).json({error:'No file uploaded. Accepted: JPG, PNG, PDF up to 10 MB.'});
  const notes=req.body.notes||'';
  const r=await one('INSERT INTO invoice_uploads(business_id,filename,original_name,mime_type,size,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[biz(req),req.file.filename,req.file.originalname,req.file.mimetype,req.file.size,notes]);
  res.status(201).json({id:r.id,filename:req.file.filename,original_name:req.file.originalname,url:'/uploads/'+req.file.filename,status:'uploaded'});
}));

app.get('/api/invoices',auth,wrap(async(req,res)=>{
  res.json(await q('SELECT * FROM invoice_uploads WHERE business_id=$1 ORDER BY id DESC',[biz(req)]));
}));

app.delete('/api/invoices/:id',auth,wrap(async(req,res)=>{
  const inv=await one('SELECT * FROM invoice_uploads WHERE id=$1 AND business_id=$2',[req.params.id,biz(req)]);
  if(inv){
    try{fs.unlinkSync(path.join(uploadsDir,inv.filename))}catch(e){}
    await q('DELETE FROM invoice_uploads WHERE id=$1',[inv.id]);
  }
  res.json({ok:true});
}));

// ─── NOTIFICATIONS ─────────────────────────────────────────────────────────
app.get('/api/notifications',auth,wrap(async(req,res)=>{
  res.json(await q('SELECT * FROM notifications WHERE business_id=$1 ORDER BY id DESC LIMIT 100',[biz(req)]));
}));
app.put('/api/notifications/:id/read',auth,wrap(async(req,res)=>{
  await q('UPDATE notifications SET read=1 WHERE id=$1 AND business_id=$2',[req.params.id,biz(req)]);
  res.json({ok:true});
}));

// ─── REPORTS ───────────────────────────────────────────────────────────────
app.get('/api/reports',auth,wrap(async(req,res)=>{
  const id=biz(req);
  const [sales,exp,pur,inventory]=await Promise.all([
    one('SELECT COUNT(*) count,COALESCE(SUM(total),0) revenue,COALESCE(SUM(purchase_price),0) cogs,COALESCE(SUM(total),0) collected FROM sales WHERE business_id=$1',[id]),
    one('SELECT COALESCE(SUM(amount),0) total FROM expenses WHERE business_id=$1',[id]),
    one('SELECT COALESCE(SUM(total),0) total FROM purchases WHERE business_id=$1',[id]),
    one('SELECT COUNT(*) products,COALESCE(SUM(stock*purchase_price),0) value FROM products WHERE business_id=$1 AND archived=0',[id])
  ]);
  res.json({sales,expenses:exp.total,purchases:pur.total,inventory,receivables:0,payables:0});
}));

// ─── SETTINGS ──────────────────────────────────────────────────────────────
app.get('/api/settings',auth,wrap(async(req,res)=>{
  res.json(await one('SELECT * FROM businesses WHERE id=$1',[biz(req)]));
}));
app.put('/api/settings',auth,wrap(async(req,res)=>{
  const {name,category,currency,address}=req.body;
  const row=await one('UPDATE businesses SET name=COALESCE($1,name),category=COALESCE($2,category),currency=COALESCE($3,currency),address=COALESCE($4,address) WHERE id=$5 RETURNING *',[name??null,category??null,currency??null,address??null,biz(req)]);
  res.json(row);
}));

// ─── Production static serve (only if a built frontend exists next to the backend) ─
const dist=path.resolve(__dirname,'../../frontend/dist');
if(process.env.NODE_ENV==='production' && fs.existsSync(path.join(dist,'index.html'))){
  app.use(express.static(dist));
  app.get('*',(req,res)=>res.sendFile(path.join(dist,'index.html')));
}

// ─── Start: set up Neon tables, then listen ────────────────────────────────
initDb()
  .catch(e=>console.error('Database setup failed:',e.message))
  .finally(()=>app.listen(PORT,()=>console.log(`BusinessOps API listening on port ${PORT}`)));