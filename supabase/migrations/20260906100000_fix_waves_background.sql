-- ============================================================
-- FIX WAVES BACKGROUND
-- Date: 2026-09-06
-- Purpose: Add proper SVG wave pattern to Waves background item
-- ============================================================

UPDATE shop_items
SET css_data = '{"image": "url(\"data:image/svg+xml,%3Csvg width=''100'' height=''20'' xmlns=''http://www.w3.org/2000/svg''%3E%3Cpath d=''M0 10 Q 25 0, 50 10 T 100 10'' stroke=''rgba(0,240,255,0.2)'' fill=''none'' stroke-width=''2''/%3E%3Cpath d=''M0 15 Q 25 5, 50 15 T 100 15'' stroke=''rgba(0,240,255,0.1)'' fill=''none'' stroke-width=''1.5''/%3E%3C/svg%3E\")", "backgroundSize": "100px 40px", "backgroundRepeat": "repeat"}'::jsonb
WHERE name = 'Waves' AND type = 'background';

-- ============================================================
-- DONE! Waves background now has a proper flowing wave pattern
-- ============================================================
