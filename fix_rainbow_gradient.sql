-- Fix Rainbow Name gradient to show all colors on short names
-- The issue: gradient is too wide for short names like "ROMEL" (only shows red)
-- Solution: Make gradient cycle 2-3 times so all colors are visible

UPDATE shop_items 
SET css_data = '{"gradient": "linear-gradient(90deg, #ff0000 0%, #ff7f00 14%, #ffff00 28%, #00ff00 42%, #0000ff 57%, #4b0082 71%, #9400d3 85%, #ff0000 100%)"}'::jsonb
WHERE name = 'Rainbow Name' 
AND type = 'name_color';

-- Verify the update
SELECT name, type, css_data 
FROM shop_items 
WHERE name = 'Rainbow Name';
