export type Product = {
 id: number; name: string; slug: string; category: string; short_description: string;
 description: string; price: number | null; show_price: number; image_url: string;
 gallery: string[]; available: number; featured: number; published: number; created_at?: string;
};
export type ProductInput = Omit<Product, "id" | "created_at">;