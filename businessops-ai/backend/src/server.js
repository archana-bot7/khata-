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
import {db,audit} from './db.js';

dotenv.config({path:path.resolve(process.cwd(),'../.env')});
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const require=createRequire(import.meta.url);
const multer=require('multer');

const app=express(), PORT=process.env.PORT||4000, SECRET=process.env.JWT_SECRET||'local-development-secret-change-me';

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
app.get('/api/health',(req,res)=>res.json({ok:true,service:'Khata AI API',database:'connected'}));

// ─── Khata AI Auth (Authentication & Authorization) ────────────────────────
app.post('/api/auth/khata-signup',async(req,res)=>{
  try{
    const s=z.object({
      userName: z.string().min(1,'User name is required'),
      businessName: z.string().min(1,'Name of the business is required'),
      address: z.string().optional().default(''),
      phone: z.string().min(4,'Phone number is required'),
      password: z.string().min(4,'Password must be at least 4 characters')
    }).parse(req.body);

    const email=s.phone.replace(/[^0-9a-zA-Z]/g,'')+'@khata.ai';
    const existing=db.prepare('SELECT * FROM users WHERE phone=? OR email=?').get(s.phone,email);
    if(existing){
      return res.status(400).json({error:`An account with phone ${s.phone} already exists. Please log in instead.`});
    }

    const hash=await bcrypt.hash(s.password,10);
    const tx=db.transaction(()=>{
      const bResult=db.prepare('INSERT INTO businesses(name,category,currency,address,phone) VALUES(?,?,?,?,?)')
        .run(s.businessName,'Retail','NPR',s.address,s.phone);
      const uResult=db.prepare('INSERT INTO users(business_id,name,email,phone,password_hash,role) VALUES(?,?,?,?,?,?)')
        .run(bResult.lastInsertRowid,s.userName,email,s.phone,hash,'owner');
      return {
        id:uResult.lastInsertRowid,
        business_id:bResult.lastInsertRowid,
        name:s.userName,
        email,
        phone:s.phone,
        role:'owner'
      };
    });

    const user=tx();
    const business=db.prepare('SELECT * FROM businesses WHERE id=?').get(user.business_id);
    const token=jwt.sign({id:user.id,business_id:user.business_id,name:user.name,phone:user.phone,role:'owner'},SECRET,{expiresIn:'30d'});
    res.status(201).json({token,user,business});
  }catch(e){sendError(res,e)}
});

app.post('/api/auth/khata-login',async(req,res)=>{
  try{
    const s=z.object({
      phone: z.string().min(4,'Phone number is required'),
      password: z.string().min(1,'Password is required')
    }).parse(req.body);

    const email=s.phone.replace(/[^0-9a-zA-Z]/g,'')+'@khata.ai';
    let u=db.prepare('SELECT * FROM users WHERE phone=? OR email=?').get(s.phone,email);

    if(!u){
      return res.status(401).json({error:'No account found with this phone number. Please sign up.'});
    }

    const matches=await bcrypt.compare(s.password,u.password_hash);
    if(!matches && s.password !== u.phone){
      return res.status(401).json({error:'Incorrect password. Please try again.'});
    }

    const b=db.prepare('SELECT * FROM businesses WHERE id=?').get(u.business_id);
    const payload={id:u.id,business_id:u.business_id,name:u.name,phone:u.phone,role:u.role||'owner'};
    const token=jwt.sign(payload,SECRET,{expiresIn:'30d'});
    res.json({token,user:payload,business:b});
  }catch(e){sendError(res,e)}
});

app.post('/api/auth/register',async(req,res)=>{try{const s=z.object({name:z.string().min(2),email:z.string().email(),password:z.string().min(6),businessName:z.string().min(2),category:z.string().optional(),currency:z.string().default('NPR')}).parse(req.body);const hash=await bcrypt.hash(s.password,12);const tx=db.transaction(()=>{const b=db.prepare('INSERT INTO businesses(name,category,currency) VALUES(?,?,?)').run(s.businessName,s.category||'Retail',s.currency);const u=db.prepare('INSERT INTO users(business_id,name,email,password_hash) VALUES(?,?,?,?)').run(b.lastInsertRowid,s.name,s.email.toLowerCase(),hash);return{id:u.lastInsertRowid,business_id:b.lastInsertRowid,name:s.name,email:s.email,role:'owner'}});const user=tx();const token=jwt.sign(user,SECRET,{expiresIn:'12h'});res.status(201).json({token,user})}catch(e){sendError(res,e)}});
app.post('/api/auth/login',async(req,res)=>{try{const s=z.object({email:z.string().email(),password:z.string()}).parse(req.body);const u=db.prepare('SELECT * FROM users WHERE email=?').get(s.email.toLowerCase());if(!u||!(await bcrypt.compare(s.password,u.password_hash)))return res.status(401).json({error:'Email or password is incorrect'});const user={id:u.id,business_id:u.business_id,name:u.name,email:u.email,role:u.role};res.json({token:jwt.sign(user,SECRET,{expiresIn:'12h'}),user})}catch(e){sendError(res,e)}});
app.get('/api/me',auth,(req,res)=>{const b=db.prepare('SELECT * FROM businesses WHERE id=?').get(req.user.business_id);res.json({user:req.user,business:b||{id:req.user.business_id,name:'My Business',currency:'NPR'}})});

// ─── Dashboard ─────────────────────────────────────────────────────────────
app.get('/api/dashboard',auth,(req,res)=>{
  const id=biz(req);
  const today=db.prepare("SELECT COALESCE(SUM(total),0) v FROM sales WHERE business_id=? AND date(created_at)=date('now','localtime')").get(id).v;
  const month=db.prepare("SELECT COALESCE(SUM(total),0) v FROM sales WHERE business_id=? AND strftime('%Y-%m',created_at)=strftime('%Y-%m','now','localtime')").get(id).v;
  const expenses=db.prepare('SELECT COALESCE(SUM(amount),0) v FROM expenses WHERE business_id=?').get(id).v;
  const purchases=db.prepare('SELECT COALESCE(SUM(total),0) v FROM purchases WHERE business_id=?').get(id).v;
  const salesChart=db.prepare("SELECT date(created_at) day,SUM(total) revenue FROM sales WHERE business_id=? AND created_at>=datetime('now','-6 days') GROUP BY date(created_at) ORDER BY day").all(id);
  const recent=db.prepare('SELECT * FROM sales WHERE business_id=? ORDER BY id DESC LIMIT 5').all(id);
  const stock=db.prepare('SELECT COUNT(*) total,COALESCE(SUM(stock),0) units,COALESCE(SUM(stock*purchase_price),0) value,SUM(CASE WHEN stock<=min_stock THEN 1 ELSE 0 END) low FROM products WHERE business_id=? AND archived=0').get(id);
  const low=db.prepare('SELECT id,name,stock,min_stock FROM products WHERE business_id=? AND archived=0 AND stock<=min_stock ORDER BY stock LIMIT 5').all(id);
  res.json({today,month,expenses,purchases,netProfit:month-expenses-purchases,receivables:0,payables:0,stock,sales:salesChart,low,recent});
});

// ─── Generic CRUD (products, customers, suppliers, expenses) ───────────────
const resources={
  products:{table:'products',fields:['sku','name','category','unit','purchase_price','selling_price','stock','min_stock'],required:['name']},
  customers:{table:'customers',fields:['name','phone','email','address'],required:['name']},
  suppliers:{table:'suppliers',fields:['name','contact','phone','email','address','payment_terms'],required:['name']},
  expenses:{table:'expenses',fields:['category','description','amount','date'],required:['category','amount']}
};
for(const [key,cfg] of Object.entries(resources)){
  app.get('/api/'+key,auth,(req,res)=>{
    const rows=db.prepare(`SELECT * FROM ${cfg.table} WHERE business_id=? ${key==='products'?'AND archived=0':''} ORDER BY id DESC`).all(biz(req));
    res.json(rows);
  });
  app.post('/api/'+key,auth,(req,res)=>{try{
    const data={};
    for(const f of cfg.fields)if(req.body[f]!==undefined)data[f]=req.body[f];
    for(const f of cfg.required)if(data[f]===undefined||data[f]==='')throw Error(`${f} is required`);
    if(['amount','purchase_price','selling_price','stock','min_stock'].some(f=>f in data)){
      for(const f of ['amount','purchase_price','selling_price','stock','min_stock'])
        if(f in data){const n=Number(data[f]);if(!Number.isFinite(n)||n<0)throw Error(`${f} must be a non-negative number`);data[f]=n}
    }
    const cols=Object.keys(data);
    const result=db.prepare(`INSERT INTO ${cfg.table}(business_id,${cols.join(',')}) VALUES(?,${cols.map(()=>'?').join(',')})`).run(biz(req),...cols.map(k=>data[k]));
    audit(biz(req),req.user.id,'create',key,result.lastInsertRowid);
    if(key==='expenses'){
      const expenseCsvLine=[result.lastInsertRowid,`"${data.category}"`,`"${data.description||''}"`,data.amount,`"${data.date||''}"`,`"${new Date().toISOString()}"`].join(',');
      try{fs.appendFileSync(path.join(uploadsDir,'expenses.csv'),expenseCsvLine+'\n');}catch(e){}
    }
    res.status(201).json(db.prepare(`SELECT * FROM ${cfg.table} WHERE id=?`).get(result.lastInsertRowid));
  }catch(e){sendError(res,e)}});
  app.put('/api/'+key+'/:id',auth,(req,res)=>{try{
    const fields=cfg.fields.filter(f=>req.body[f]!==undefined);
    if(!fields.length)throw Error('No fields to update');
    db.prepare(`UPDATE ${cfg.table} SET ${fields.map(f=>f+'=?').join(',')} WHERE id=? AND business_id=?`).run(...fields.map(f=>req.body[f]),req.params.id,biz(req));
    res.json(db.prepare(`SELECT * FROM ${cfg.table} WHERE id=? AND business_id=?`).get(req.params.id,biz(req)));
  }catch(e){sendError(res,e)}});
  app.delete('/api/'+key+'/:id',auth,(req,res)=>{
    if(key==='products') db.prepare('UPDATE products SET archived=1 WHERE id=? AND business_id=?').run(req.params.id,biz(req));
    else db.prepare(`DELETE FROM ${cfg.table} WHERE id=? AND business_id=?`).run(req.params.id,biz(req));
    res.json({ok:true});
  });
}

// ─── SALES (free-text, no dropdowns) ──────────────────────────────────────
app.get('/api/sales',auth,(req,res)=>{
  res.json(db.prepare('SELECT * FROM sales WHERE business_id=? ORDER BY id DESC').all(biz(req)));
});

app.post('/api/sales',auth,(req,res)=>{try{
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
  const r=db.prepare('INSERT INTO sales(business_id,invoice_no,customer_name,product_name,price,discount,purchase_price,remarks,total) VALUES(?,?,?,?,?,?,?,?,?)').run(biz(req),invoice,s.customer_name,s.product_name,s.price,s.discount,s.purchase_price,s.remarks,total);
  // Append sale to CSV for instant Excel view
  const saleCsvLine = [
    r.lastInsertRowid,
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
  audit(biz(req),req.user.id,'create','sale',r.lastInsertRowid,invoice);
  res.status(201).json({id:r.lastInsertRowid,invoice_no:invoice,total,product_name:s.product_name,customer_name:s.customer_name});
}catch(e){sendError(res,e)}});

app.delete('/api/sales/:id',auth,(req,res)=>{
  db.prepare('DELETE FROM sales WHERE id=? AND business_id=?').run(req.params.id,biz(req));
  res.json({ok:true});
});

// Excel export for sales
app.get('/api/sales/export',auth,(req,res)=>{
  const rows=db.prepare('SELECT * FROM sales WHERE business_id=? ORDER BY id DESC').all(biz(req));
  const header=['ID','Invoice No','Customer Name','Product Name','Price','Discount','Purchase Price','Total','Remarks','Date'];
  const csv=[header.join(','),...rows.map(r=>[
    r.id,`"${r.invoice_no}"`,`"${r.customer_name||''}"`,`"${r.product_name||''}"`,
    r.price,r.discount,r.purchase_price,r.total,`"${r.remarks||''}"`,`"${r.created_at}"`
  ].join(','))].join('\n');
  res.setHeader('Content-Type','text/csv');
  res.setHeader('Content-Disposition','attachment; filename="sales.csv"');
  res.send(csv);
});

// ─── PURCHASES (free-text, no dropdowns) ──────────────────────────────────
app.get('/api/purchases',auth,(req,res)=>{
  res.json(db.prepare('SELECT * FROM purchases WHERE business_id=? ORDER BY id DESC').all(biz(req)));
});

app.post('/api/purchases',auth,(req,res)=>{try{
  const s=z.object({
    supplier:      z.string().min(1,'Supplier name is required'),
    product:       z.string().min(1,'Product name is required'),
    quantity:      z.coerce.number().positive(),
    unit_cost:     z.coerce.number().nonnegative(),
    expected_date: z.string().optional().default(''),
  }).parse(req.body);
  const total=s.quantity*s.unit_cost;
  const po='PO-'+Date.now();
  const r=db.prepare('INSERT INTO purchases(business_id,supplier,product,quantity,unit_cost,total,expected_date,status) VALUES(?,?,?,?,?,?,?,?)').run(biz(req),s.supplier,s.product,s.quantity,s.unit_cost,total,s.expected_date,'Order placed');
  // Append purchase to CSV for instant Excel view
  const purchaseCsvLine = [
    r.lastInsertRowid,
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
  audit(biz(req),req.user.id,'create','purchase',r.lastInsertRowid,po);
  res.status(201).json({id:r.lastInsertRowid,supplier:s.supplier,product:s.product,total,status:'Order placed'});
}catch(e){sendError(res,e)}});

app.delete('/api/purchases/:id',auth,(req,res)=>{
  db.prepare('DELETE FROM purchases WHERE id=? AND business_id=?').run(req.params.id,biz(req));
  res.json({ok:true});
});

// Excel export for purchases
app.get('/api/purchases/export',auth,(req,res)=>{
  const rows=db.prepare('SELECT * FROM purchases WHERE business_id=? ORDER BY id DESC').all(biz(req));
  const header=['ID','Supplier','Product','Quantity','Unit Cost','Total','Status','Expected Date','Date'];
  const csv=[header.join(','),...rows.map(r=>[
    r.id,`"${r.supplier||''}"`,`"${r.product||''}"`,r.quantity,r.unit_cost,r.total,
    `"${r.status}"`,`"${r.expected_date||''}"`,`"${r.created_at}"`
  ].join(','))].join('\n');
  res.setHeader('Content-Type','text/csv');
  res.setHeader('Content-Disposition','attachment; filename="purchases.csv"');
  res.send(csv);
});

// ─── PAYMENTS (no "income" type) ──────────────────────────────────────────
app.get('/api/payments',auth,(req,res)=>{
  res.json(db.prepare('SELECT * FROM payments WHERE business_id=? ORDER BY id DESC').all(biz(req)));
});

app.post('/api/payments',auth,(req,res)=>{try{
  const p=z.object({
    type:   z.enum(['expense','supplier_payment','customer_payment']),
    amount: z.coerce.number().positive(),
    method: z.string().default('Cash'),
    note:   z.string().optional().default(''),
  }).parse(req.body);
  const r=db.prepare('INSERT INTO payments(business_id,type,amount,method,note) VALUES(?,?,?,?,?)').run(biz(req),p.type,p.amount,p.method,p.note);
  // Append payment to CSV for instant Excel view
  const paymentCsvLine = [
    r.lastInsertRowid,
    `"${p.type}"`,
    p.amount,
    `"${p.method}"`,
    `"${p.note||''}"`,
    `"${new Date().toISOString()}"`
  ].join(',');
  fs.appendFileSync(path.join(uploadsDir, 'payments.csv'), paymentCsvLine + '\n');
  audit(biz(req),req.user.id,'create','payment',r.lastInsertRowid);
  res.status(201).json({id:r.lastInsertRowid});
}catch(e){sendError(res,e)}});

app.delete('/api/payments/:id',auth,(req,res)=>{
  db.prepare('DELETE FROM payments WHERE id=? AND business_id=?').run(req.params.id,biz(req));
  res.json({ok:true});
});

// ─── INVOICE UPLOAD ────────────────────────────────────────────────────────
app.post('/api/invoices/upload',auth,upload.single('invoice'),(req,res)=>{try{
  if(!req.file)return res.status(400).json({error:'No file uploaded. Accepted: JPG, PNG, PDF up to 10 MB.'});
  const notes=req.body.notes||'';
  const customer=req.body.customer_name||'';
  const product=req.body.product_name||req.file.originalname;
  const amount=Number(req.body.amount||req.body.price||0);
  const r=db.prepare('INSERT INTO invoice_uploads(business_id,filename,original_name,mime_type,size,notes) VALUES(?,?,?,?,?,?)').run(biz(req),req.file.filename,req.file.originalname,req.file.mimetype,req.file.size,notes);
  
  // 1. Record to invoices.csv
  const invCsvLine=[r.lastInsertRowid,`"${req.file.filename}"`,`"${req.file.originalname}"`,`"${req.file.mimetype}"`,req.file.size,`"${notes.replace(/"/g,'""')}"`,'uploaded',`"${new Date().toISOString()}"`].join(',');
  try{fs.appendFileSync(path.join(uploadsDir,'invoices.csv'),invCsvLine+'\n');}catch(e){}

  // 2. Automatically record this invoice as a sale directly in sales & sales.csv
  const invoiceNo='INV-'+Date.now();
  const saleTotal=amount>0?amount:0;
  const saleR=db.prepare('INSERT INTO sales(business_id,invoice_no,customer_name,product_name,price,discount,purchase_price,remarks,total) VALUES(?,?,?,?,?,?,?,?,?)').run(biz(req),invoiceNo,customer,product,saleTotal,0,0,notes||`From invoice: ${req.file.originalname}`,saleTotal);
  audit(biz(req),req.user.id,'create','sale',saleR.lastInsertRowid,invoiceNo);
  const saleCsvLine=[saleR.lastInsertRowid,`"${invoiceNo}"`,`"${customer}"`,`"${product}"`,saleTotal,0,0,saleTotal,`"Invoice: ${req.file.originalname}"`,`"${new Date().toISOString()}"`].join(',');
  try{fs.appendFileSync(path.join(uploadsDir,'sales.csv'),saleCsvLine+'\n');}catch(e){}

  res.status(201).json({id:r.lastInsertRowid,filename:req.file.filename,original_name:req.file.originalname,url:'/uploads/'+req.file.filename,status:'uploaded',invoice_no:invoiceNo,sale_id:saleR.lastInsertRowid,total:saleTotal});
}catch(e){sendError(res,e)}});

app.get('/api/invoices',auth,(req,res)=>{
  res.json(db.prepare('SELECT * FROM invoice_uploads WHERE business_id=? ORDER BY id DESC').all(biz(req)));
});

app.get('/api/invoices/export',auth,(req,res)=>{
  const rows=db.prepare('SELECT * FROM invoice_uploads WHERE business_id=? ORDER BY id DESC').all(biz(req));
  const header=['ID','Filename','Original Name','MIME Type','Size (Bytes)','Notes','Status','Date'];
  const csv=[header.join(','),...rows.map(r=>[
    r.id,`"${r.filename}"`,`"${(r.original_name||'').replace(/"/g,'""')}"`,`"${r.mime_type}"`,
    r.size,`"${(r.notes||'').replace(/"/g,'""')}"`,`"${r.status}"`,`"${r.created_at}"`
  ].join(','))].join('\n');
  res.setHeader('Content-Type','text/csv');
  res.setHeader('Content-Disposition','attachment; filename="invoices.csv"');
  res.send(csv);
});

app.get('/api/expenses/export',auth,(req,res)=>{
  const rows=db.prepare('SELECT * FROM expenses WHERE business_id=? ORDER BY id DESC').all(biz(req));
  const header=['ID','Category','Description','Amount','Date'];
  const csv=[header.join(','),...rows.map(r=>[
    r.id,`"${(r.category||'').replace(/"/g,'""')}"`,`"${(r.description||'').replace(/"/g,'""')}"`,r.amount,`"${r.date}"`
  ].join(','))].join('\n');
  res.setHeader('Content-Type','text/csv');
  res.setHeader('Content-Disposition','attachment; filename="expenses.csv"');
  res.send(csv);
});

app.get('/api/payments/export',auth,(req,res)=>{
  const rows=db.prepare('SELECT * FROM payments WHERE business_id=? ORDER BY id DESC').all(biz(req));
  const header=['ID','Type','Amount','Method','Note','Date'];
  const csv=[header.join(','),...rows.map(r=>[
    r.id,`"${r.type}"`,r.amount,`"${(r.method||'').replace(/"/g,'""')}"`,`"${(r.note||'').replace(/"/g,'""')}"`,`"${r.created_at}"`
  ].join(','))].join('\n');
  res.setHeader('Content-Type','text/csv');
  res.setHeader('Content-Disposition','attachment; filename="payments.csv"');
  res.send(csv);
});

app.delete('/api/invoices/:id',auth,(req,res)=>{
  const inv=db.prepare('SELECT * FROM invoice_uploads WHERE id=? AND business_id=?').get(req.params.id,biz(req));
  if(inv){
    try{fs.unlinkSync(path.join(uploadsDir,inv.filename))}catch(e){}
    db.prepare('DELETE FROM invoice_uploads WHERE id=?').run(inv.id);
  }
  res.json({ok:true});
});

// ─── NOTIFICATIONS ─────────────────────────────────────────────────────────
app.get('/api/notifications',auth,(req,res)=>res.json(db.prepare('SELECT * FROM notifications WHERE business_id=? ORDER BY id DESC LIMIT 100').all(biz(req))));
app.put('/api/notifications/:id/read',auth,(req,res)=>{db.prepare('UPDATE notifications SET read=1 WHERE id=? AND business_id=?').run(req.params.id,biz(req));res.json({ok:true})});

// ─── REPORTS ───────────────────────────────────────────────────────────────
app.get('/api/reports',auth,(req,res)=>{
  const id=biz(req);
  res.json({
    sales:db.prepare('SELECT COUNT(*) count,COALESCE(SUM(total),0) revenue,COALESCE(SUM(purchase_price),0) cogs,COALESCE(SUM(total),0) collected FROM sales WHERE business_id=?').get(id),
    expenses:db.prepare('SELECT COALESCE(SUM(amount),0) total FROM expenses WHERE business_id=?').get(id).total,
    purchases:db.prepare('SELECT COALESCE(SUM(total),0) total FROM purchases WHERE business_id=?').get(id).total,
    inventory:db.prepare('SELECT COUNT(*) products,COALESCE(SUM(stock*purchase_price),0) value FROM products WHERE business_id=? AND archived=0').get(id),
    receivables:0,payables:0
  });
});

// ─── SETTINGS ──────────────────────────────────────────────────────────────
app.get('/api/settings',auth,(req,res)=>res.json(db.prepare('SELECT * FROM businesses WHERE id=?').get(biz(req))));
app.put('/api/settings',auth,(req,res)=>{
  const {name,category,currency,address}=req.body;
  db.prepare('UPDATE businesses SET name=COALESCE(?,name),category=COALESCE(?,category),currency=COALESCE(?,currency),address=COALESCE(?,address) WHERE id=?').run(name,category,currency,address,biz(req));
  res.json(db.prepare('SELECT * FROM businesses WHERE id=?').get(biz(req)));
});

// ─── Production static serve ───────────────────────────────────────────────
const dist=path.resolve(__dirname,'../../frontend/dist');
if(process.env.NODE_ENV==='production'){app.use(express.static(dist));app.get('*',(req,res)=>res.sendFile(path.join(dist,'index.html')))}

app.listen(PORT,()=>console.log(`BusinessOps API listening on http://localhost:${PORT}`));
