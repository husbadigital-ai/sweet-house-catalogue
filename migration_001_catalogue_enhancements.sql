-- SweetHouse additive migration 001.
-- Run ONCE against the existing D1 database before deploying the matching API code.
-- This migration preserves all existing product rows and settings.
ALTER TABLE products ADD COLUMN name_hi TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN description_hi TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN unit TEXT NOT NULL DEFAULT 'per kg';
ALTER TABLE products ADD COLUMN ingredients TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN shelf_life TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN contains_nuts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN weights_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE products ADD COLUMN badge TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN enquiry_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products(published, sort_order, featured);

-- Seed the requested public defaults without overwriting anything the shop has already configured.
INSERT INTO settings(key, value) VALUES
 ('tagline', 'Indian Sweet Boutique'),
 ('logoUrl', ''),
 ('heroImage', ''),
 ('headline', 'SweetHouse'),
 ('subline', 'Browse our sweets and enquire directly on WhatsApp.'),
 ('aboutText', 'Traditional Indian sweets made for sharing.'),
 ('productWhatsAppTemplate', 'Namaste! I would like to enquire about *{product}* ({quantity}) – {price}. Link: {url}'),
 ('productWhatsAppTemplateHi', 'Namaste! Mujhe *{product}* ({quantity}) ke baare mein jaankari chahiye – {price}. Link: {url}'),
 ('generalWhatsAppTemplate', 'Namaste! I would like to know more about your sweets.'),
 ('generalWhatsAppTemplateHi', 'Namaste! Mujhe aapki mithaiyon ke baare mein jaankari chahiye.'),
 ('showSearch', '0'),
 ('trackEnquiries', '1'),
 ('footerText', 'SweetHouse – Indian Sweet Boutique'),
 ('hiddenCategories', '')
ON CONFLICT(key) DO NOTHING;

INSERT INTO settings(key, value) VALUES ('trustOne', 'Made for celebrations'), ('trustTwo', 'Direct WhatsApp enquiries'), ('trustThree', 'Shop details below') ON CONFLICT(key) DO NOTHING;

-- Carry forward existing offer banner content rather than overwriting it.
INSERT INTO settings(key, value) SELECT 'festivalEnabled', COALESCE((SELECT value FROM settings WHERE key='offerEnabled'), '0') ON CONFLICT(key) DO NOTHING;
INSERT INTO settings(key, value) SELECT 'festivalNotice', COALESCE((SELECT value FROM settings WHERE key='offerText'), 'Festival orders are open') ON CONFLICT(key) DO NOTHING;

-- Preserve weight options and product badges previously stored as settings keys.
WITH RECURSIVE weight_lines(slug, rest, line) AS (
  SELECT substr(key, 9), value || char(10), ''
  FROM settings WHERE key LIKE 'weights_%'
  UNION ALL
  SELECT slug, substr(rest, instr(rest, char(10)) + 1), substr(rest, 1, instr(rest, char(10)) - 1)
  FROM weight_lines WHERE rest <> ''
), weight_data AS (
  SELECT slug, json_group_array(json_object(
    'label', trim(substr(line, 1, instr(line, ':') - 1)),
    'price', CAST(trim(substr(line, instr(line, ':') + 1)) AS REAL)
  )) AS weights_json
  FROM weight_lines WHERE line <> '' AND instr(line, ':') > 0 GROUP BY slug
)
UPDATE products SET weights_json = (SELECT weight_data.weights_json FROM weight_data WHERE weight_data.slug = products.slug)
WHERE EXISTS (SELECT 1 FROM weight_data WHERE weight_data.slug = products.slug);

UPDATE products SET badge = (SELECT value FROM settings WHERE key = 'flags_' || products.slug)
WHERE badge = '' AND EXISTS (SELECT 1 FROM settings WHERE key = 'flags_' || products.slug);
