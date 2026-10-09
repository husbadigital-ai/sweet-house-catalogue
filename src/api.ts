import type { Product, ProductInput } from "./types";
async function request<T>(url: string, init?: RequestInit): Promise<T> {
 const r = await fetch(url, { credentials: "same-origin", ...init });
 const data = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
 return data as T;
}
export const api = {
 products: () => request<{products: Product[]}>("/api/products"),
 adminProducts: () => request<{products: Product[]}>("/api/products?admin=1"),
 login: (username: string, password: string) => request<{ok:boolean}>("/api/login", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username,password})}),
 logout: () => request<{ok:boolean}>("/api/logout",{method:"POST"}),
 me: () => request<{authenticated:boolean}>("/api/me"),
 settings: () => request<{settings:{whatsapp:string;shopName:string}}>("/api/settings"),
 saveSettings: (settings:{whatsapp:string;shopName:string}) => request<{ok:boolean;settings:{whatsapp:string;shopName:string}}>("/api/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(settings)}),
 save: (p: ProductInput, id?: number) => request<{product: Product}>("/api/products"+(id?`/${id}`:""), {method:id?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p)}),
 remove: (id:number) => request<{ok:boolean}>(`/api/products/${id}`,{method:"DELETE"}),
 upload: async (file: File, onProgress: (n:number)=>void) => {
   // XMLHttpRequest is used for reliable upload progress reporting.
   return new Promise<{url:string}>((resolve,reject)=>{
    const xhr=new XMLHttpRequest(); xhr.open("POST","/api/upload"); xhr.withCredentials=true;
    xhr.upload.onprogress=e=>{if(e.lengthComputable)onProgress(Math.round(e.loaded/e.total*100));};
    xhr.onload=()=>{try{const d=JSON.parse(xhr.responseText); if(xhr.status>=200&&xhr.status<300)resolve(d);else reject(new Error(d.error||"Upload failed"));}catch{reject(new Error("Unexpected upload response"));}};
    xhr.onerror=()=>reject(new Error("Network error while uploading")); const form=new FormData();form.append("file",file);xhr.send(form);
   });
 }
};