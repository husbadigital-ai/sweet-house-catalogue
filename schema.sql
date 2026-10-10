-- Fresh database schema for SweetHouse. Existing databases should use migration_001_catalogue_enhancements.sql.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 name_hi TEXT NOT NULL DEFAULT '',
 slug TEXT NOT NULL UNIQUE CHECK(length(slug) BETWEEN 1 AND 120),
 category TEXT NOT NULL DEFAULT 'Traditional Mithai',
 short_description TEXT NOT NULL DEFAULT '',
 description TEXT NOT NULL DEFAULT '',
 description_hi TEXT NOT NULL DEFAULT '',
 price REAL CHECK(price IS NULL OR price >= 0),
 show_price INTEGER NOT NULL DEFAULT 0 CHECK(show_price IN (0,1)),
 unit TEXT NOT NULL DEFAULT 'per kg',
 ingredients TEXT NOT NULL DEFAULT '',
 shelf_life TEXT NOT NULL DEFAULT '',
 contains_nuts INTEGER NOT NULL DEFAULT 0 CHECK(contains_nuts IN (0,1)),
 weights_json TEXT NOT NULL DEFAULT '[]',
 badge TEXT NOT NULL DEFAULT '',
 sort_order INTEGER NOT NULL DEFAULT 0,
 enquiry_count INTEGER NOT NULL DEFAULT 0,
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
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(published, sort_order, featured);
CREATE TABLE IF NOT EXISTS settings (
 key TEXT PRIMARY KEY,
 value TEXT NOT NULL,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
