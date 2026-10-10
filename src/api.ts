import type { Product, ProductInput, ShopSettings } from "./types";
async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}
export const api = {
  products: () => request<{ products: Product[] }>("/api/products"),
  adminProducts: () => request<{ products: Product[] }>("/api/products?admin=1"),
  login: (username: string, password: string) => request<{ ok: boolean }>("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) }),
  logout: () => request<{ ok: boolean }>("/api/logout", { method: "POST" }),
  me: () => request<{ authenticated: boolean }>("/api/me"),
  settings: () => request<{ settings: ShopSettings }>("/api/settings"),
  saveSettings: (settings: ShopSettings) => request<{ ok: boolean; settings: ShopSettings }>("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) }),
  save: (product: ProductInput, id?: number) => request<{ product: Product }>(`/api/products${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(product) }),
  remove: (id: number) => request<{ ok: boolean }>(`/api/products/${id}`, { method: "DELETE" }),
  trackEnquiry: (id: number) => request<{ ok: boolean }>(`/api/enquiry/${id}`, { method: "POST" }),
  insights: () => request<{ products: { id: number; name: string; enquiry_count: number }[]; totalClicks: number }>("/api/insights"),
  upload: async (file: File, onProgress: (percent: number) => void) => new Promise<{ url: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest(); xhr.open("POST", "/api/upload"); xhr.withCredentials = true;
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = () => { try { const data = JSON.parse(xhr.responseText); if (xhr.status >= 200 && xhr.status < 300) resolve(data); else reject(new Error(data.error || "Upload failed")); } catch { reject(new Error("Unexpected upload response")); } };
    xhr.onerror = () => reject(new Error("Network error while uploading")); const form = new FormData(); form.append("file", file); xhr.send(form);
  })
};
