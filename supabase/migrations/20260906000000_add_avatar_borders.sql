-- ============================================================
-- ADD AVATAR BORDER ITEMS TO SHOP
-- Date: 2026-09-06
-- Purpose: Add Friendster-style avatar border customizations
-- ============================================================

-- First, add the column to user_profile_settings
ALTER TABLE user_profile_settings 
ADD COLUMN IF NOT EXISTS active_avatar_border uuid REFERENCES shop_items(id) ON DELETE SET NULL;

-- Add avatar_border to allowed types in shop_items
ALTER TABLE shop_items 
DROP CONSTRAINT IF EXISTS shop_items_type_check;

ALTER TABLE shop_items 
ADD CONSTRAINT shop_items_type_check 
CHECK (type IN ('theme', 'badge', 'background', 'name_color', 'music', 'avatar_border'));

-- Add avatar borders to shop
INSERT INTO shop_items (name, description, type, price, preview_url, css_data) VALUES
  ('Gold Ring', 'Classic gold border', 'avatar_border', 3, '�', '{"border": "3px solid #ffd700", "boxShadow": "0 0 10px rgba(255,215,0,0.5)"}'),
  ('Neon Glow', 'Glowing cyan border', 'avatar_border', 4, '�', '{"border": "2px solid #00f0ff", "boxShadow": "0 0 15px rgba(0,240,255,0.8)"}'),
  ('Fire Ring', 'Fiery red glow', 'avatar_border', 5, '🔥', '{"border": "3px solid #ff4500", "boxShadow": "0 0 20px rgba(255,69,0,0.8)"}'),
  ('Rainbow Ring', 'Rainbow gradient border', 'avatar_border', 6, '🌈', '{"border": "4px solid transparent", "borderImage": "linear-gradient(45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #8b00ff) 1", "boxShadow": "0 0 12px rgba(255,255,255,0.5)"}'),
  ('Ice Frame', 'Frozen blue border', 'avatar_border', 4, '❄️', '{"border": "3px solid #00d4ff", "boxShadow": "0 0 15px rgba(0,212,255,0.6)"}'),
  ('Purple Aura', 'Mystical purple glow', 'avatar_border', 4, '💜', '{"border": "3px solid #9400d3", "boxShadow": "0 0 18px rgba(148,0,211,0.7)"}'),
  ('Emerald Edge', 'Green gem border', 'avatar_border', 5, '💚', '{"border": "3px solid #00ff88", "boxShadow": "0 0 15px rgba(0,255,136,0.6)"}'),
  ('Diamond Frame', 'Sparkling white border', 'avatar_border', 7, '💎', '{"border": "3px solid #ffffff", "boxShadow": "0 0 20px rgba(255,255,255,0.9), inset 0 0 10px rgba(255,255,255,0.3)"}');

-- ============================================================
-- DONE! Avatar borders feature complete
-- ============================================================
