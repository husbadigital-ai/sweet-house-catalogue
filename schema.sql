-- Run this in Cloudflare Dashboard > Storage & databases > D1 > your database > Console.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 slug TEXT NOT NULL UNIQUE CHECK(length(slug) BETWEEN 1 AND 120),
 category TEXT NOT NULL DEFAULT 'Traditional Mithai',
 short_description TEXT NOT NULL DEFAULT '',
 description TEXT NOT NULL DEFAULT '',
 price REAL CHECK(price IS NULL OR price >= 0),
 show_price INTEGER NOT NULL DEFAULT 0 CHECK(show_price IN (0,1)),
 image_url TEXT NOT NULL DEFAULT '',
 gallery TEXT NOT NULL DEFAULT '[]',
 available INTEGER NOT NULL DEFAULT 1 CHECK(available IN (0,1)),
 featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1)),
 published INTEGER NOT NULL DEFAULT 1 CHECK(published IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_products_published_featured ON products(published, featured);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE TABLE IF NOT EXISTS settings (
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);