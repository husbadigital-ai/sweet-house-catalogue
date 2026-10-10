interface Env {
 DB: D1Database;
 IMAGES: R2Bucket;
 ADMIN_USERNAME: string;
 ADMIN_PASSWORD: string;
 SESSION_SECRET: string;
 R2_PUBLIC_BASE_URL?: string;
}
type Ctx = {request:Request; env:Env; params:Record<string,string>; waitUntil:(p:Promise<unknown>)=>void};
const json=(data:unknown,status=200,headers:HeadersInit={})=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...headers}});
const cookieName="sweet_admin";
function b64(bytes:ArrayBuffer){return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");}
async function sign(payload:string,secret:string){const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);return b64(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(payload)));}
async function sessionToken(secret:string){const payload=b64(new TextEncoder().encode(JSON.stringify({exp:Date.now()+8*60*60*1000,nonce:crypto.randomUUID()})).buffer);return `${payload}.${await sign(payload,secret)}`;}
async function isAdmin(req:Request,env:Env){if(!env.SESSION_SECRET)return false;const token=(req.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith(cookieName+"="))?.slice(cookieName.length+1);if(!token)return false;const [payload,sig]=token.split(".");if(!payload||!sig)return false;try{if(await sign(payload,env.SESSION_SECRET)!==sig)return false;const raw=atob(payload.replace(/-/g,"+").replace(/_/g,"/"));return JSON.parse(raw).exp>Date.now();}catch{return false;}}
const authCookie=(token:string)=>`${cookieName}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=28800`;
function safeSlug(s:string){return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)&&s.length<=120;}
function validProduct(p:any){return p&&typeof p.name==="string"&&p.name.trim().length>0&&p.name.length<=100&&typeof p.slug==="string"&&safeSlug(p.slug)&&typeof p.category==="string"&&p.category.trim().length<=80&&typeof p.image_url==="string"&&p.image_url.length<=2048&&Array.isArray(p.gallery)&&p.gallery.length<=12&&p.gallery.every((x:any)=>typeof x==="string"&&x.length<=2048)&&[0,1].includes(Number(p.show_price))&&[0,1].includes(Number(p.available))&&[0,1].includes(Number(p.featured))&&[0,1].includes(Number(p.published))&&(p.price===null||p.price===""||(Number.isFinite(Number(p.price))&&Number(p.price)>=0&&Number(p.price)<100000000));}
const fields="id,name,slug,category,short_description,description,price,show_price,image_url,gallery,available,featured,published,created_at";
function parseProduct(row:any){return {...row,gallery:JSON.parse(row.gallery||"[]")};}
export async function onRequest(ctx:Ctx){
 const {request,env}=ctx;const url=new URL(request.url);const path=url.pathname.replace(/^\/api\/?/,"").replace(/\/$/,"");const method=request.method;
 if(path==="login"&&method==="POST"){
  const body=await request.json().catch(()=>null) as any;
  if(!env.ADMIN_USERNAME||!env.ADMIN_PASSWORD||!env.SESSION_SECRET)return json({error:"Admin secrets are not configured in Cloudflare Pages settings."},503);
  if(!body||typeof body.username!=="string"||typeof body.password!=="string"||body.username!==env.ADMIN_USERNAME||body.password!==env.ADMIN_PASSWORD)return json({error:"Incorrect username or password."},401);
  return json({ok:true},200,{"Set-Cookie":authCookie(await sessionToken(env.SESSION_SECRET))});
 }
 if(path==="logout"&&method==="POST")return json({ok:true},200,{"Set-Cookie":`${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`});
 if(path==="me"&&method==="GET")return json({authenticated:await isAdmin(request,env)});
 if(path==="settings"&&method==="GET"){
  const rows=await env.DB.prepare("SELECT key,value FROM settings").all();
  const settings=Object.fromEntries((rows.results||[]).map((r:any)=>[r.key,r.value]));
  return json({settings:{...settings,whatsapp:settings.whatsapp||"",shopName:settings.shopName||"Sweet House"}});
 }
 if(path==="settings"&&(method==="PUT"||method==="POST")){
  if(!await isAdmin(request,env))return json({error:"Admin access is required."},401);
  const body=await request.json().catch(()=>null) as any;
  const allowed=["whatsapp","shopName","tagline","phone","address","mapsUrl","mapsEmbed","timings","fssai","instagram","facebook","offerText","offerEnabled","heroImage","aboutText","categories","reviews","bulkMessage"];
  const incoming:Record<string,string>={};
  for(const key of allowed){if(body?.[key]!==undefined)incoming[key]=String(body[key]??"").slice(0,key==="aboutText"?3000:1000);}
  for(const [key,value] of Object.entries(body||{})){if(/^(weights|flags)_[a-z0-9-]{1,120}$/.test(key))incoming[key]=String(value??"").slice(0,1000);}
  const whatsapp=String(incoming.whatsapp??"").replace(/[^0-9]/g,"").slice(0,16);
  const shopName=String(incoming.shopName??"Sweet House").trim().slice(0,80);
  if(whatsapp.length && (whatsapp.length<8||whatsapp.length>15))return json({error:"Enter a WhatsApp number with country code, digits only."},400);
  incoming.whatsapp=whatsapp;incoming.shopName=shopName||"Sweet House";
  for(const [key,value] of Object.entries(incoming)){
   await env.DB.prepare("INSERT INTO settings(key,value,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=CURRENT_TIMESTAMP").bind(key,value).run();
  }
  const rows=await env.DB.prepare("SELECT key,value FROM settings").all();
  const settings=Object.fromEntries((rows.results||[]).map((r:any)=>[r.key,r.value]));
  return json({ok:true,settings});
 }
 if(path==="products"&&method==="GET"){
  const admin=url.searchParams.get("admin")==="1";if(admin&&!await isAdmin(request,env))return json({error:"Admin access is required."},401);
  if(!env.DB)return json({products:[]});
  const result=admin?await env.DB.prepare(`SELECT ${fields} FROM products ORDER BY created_at DESC`).all():await env.DB.prepare(`SELECT ${fields} FROM products WHERE published=1 ORDER BY featured DESC, created_at DESC`).all();
  return json({products:(result.results||[]).map(parseProduct)});
 }
 if(path==="products"&&(method==="POST")){
  if(!await isAdmin(request,env))return json({error:"Admin access is required."},401);
  const p=await request.json().catch(()=>null);if(!validProduct(p))return json({error:"Check required fields, URL slug, price and image links."},400);
  try{const r=await env.DB.prepare("INSERT INTO products (name,slug,category,short_description,description,price,show_price,image_url,gallery,available,featured,published) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(p.name.trim(),p.slug,p.category.trim(),String(p.short_description||"").slice(0,180),String(p.description||"").slice(0,5000),p.price===""?null:p.price,Number(p.show_price),p.image_url,JSON.stringify(p.gallery),Number(p.available),Number(p.featured),Number(p.published)).run();return json({product:{...p,id:r.meta.last_row_id}},201);}catch(e){return json({error:String(e).includes("UNIQUE")?"That URL slug is already used. Change the slug.":"Could not save product. Confirm the D1 schema is installed."},400);}
 }
 const match=path.match(/^products\/(\d+)$/);
 if(match){
  if(!await isAdmin(request,env))return json({error:"Admin access is required."},401);
  const id=Number(match[1]);
  if(method==="DELETE"){await env.DB.prepare("DELETE FROM products WHERE id=?").bind(id).run();return json({ok:true});}
  if(method==="PUT"){
   const p=await request.json().catch(()=>null);if(!validProduct(p))return json({error:"Check required fields, URL slug, price and image links."},400);
   try{await env.DB.prepare("UPDATE products SET name=?,slug=?,category=?,short_description=?,description=?,price=?,show_price=?,image_url=?,gallery=?,available=?,featured=?,published=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(p.name.trim(),p.slug,p.category.trim(),String(p.short_description||"").slice(0,180),String(p.description||"").slice(0,5000),p.price===""?null:p.price,Number(p.show_price),p.image_url,JSON.stringify(p.gallery),Number(p.available),Number(p.featured),Number(p.published),id).run();return json({product:{...p,id}});}catch{return json({error:"Could not update product. Check that its slug is unique."},400);}
  }
 }
 if(path==="upload"&&method==="POST"){
  if(!await isAdmin(request,env))return json({error:"Admin access is required."},401);
  if(!env.IMAGES)return json({error:"R2 binding IMAGES is not configured."},503);
  const form=await request.formData().catch(()=>null);const file=form?.get("file");
  if(!(file instanceof File))return json({error:"Choose an image file."},400);
  if(file.size>10*1024*1024)return json({error:"Image must be 10 MB or smaller."},413);
  const allowed:Record<string,string>={"image/jpeg":"jpg","image/png":"png","image/webp":"webp","image/avif":"avif"};
  if(!allowed[file.type])return json({error:"Use JPG, PNG, WebP or AVIF."},415);
  const key=`products/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.${allowed[file.type]}`;
  await env.IMAGES.put(key,file.stream(),{httpMetadata:{contentType:file.type,cacheControl:"public, max-age=31536000, immutable"}});
  if(!env.R2_PUBLIC_BASE_URL)return json({error:"Upload stored, but R2_PUBLIC_BASE_URL is missing. Configure the bucket's public/custom domain URL."},503);
  return json({url:`${env.R2_PUBLIC_BASE_URL.replace(/\/$/,"")}/${key}`},201);
 }
 return json({error:"API route not found."},404);
}