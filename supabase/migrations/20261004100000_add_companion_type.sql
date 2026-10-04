-- Add companion sticker type to shop_items
ALTER TABLE shop_items 
DROP CONSTRAINT IF EXISTS shop_items_type_check;

ALTER TABLE shop_items 
ADD CONSTRAINT shop_items_type_check 
CHECK (type IN ('theme', 'badge', 'background', 'name_color', 'music', 'avatar_border', 'companion'));

-- Add active_companion column to user_profile_settings
ALTER TABLE user_profile_settings
ADD COLUMN IF NOT EXISTS active_companion uuid REFERENCES shop_items(id) ON DELETE SET NULL;

-- Insert first companion sticker — Naruto chibi
INSERT INTO shop_items (name, description, type, price, preview_url, css_data, is_active)
VALUES (
  'Naruto Chibi',
  'Chibi Naruto companion sticker for your profile.',
  'companion',
  10,
  'https://banner2.cleanpng.com/cb3/qbd/tgr/a4lu9p9ci.webp',
  '{"url": "https://banner2.cleanpng.com/cb3/qbd/tgr/a4lu9p9ci.webp", "size": "64px"}',
  true
);
