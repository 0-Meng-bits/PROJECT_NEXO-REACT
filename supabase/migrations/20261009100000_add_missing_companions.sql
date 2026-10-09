-- Re-insert companions that may not have been applied from 20261007200000
-- Uses WHERE NOT EXISTS so it's safe even without a unique constraint

INSERT INTO shop_items (name, description, type, price, preview_url, css_data, is_active)
SELECT 'Tanjiro', 'A cute chibi Tanjiro companion sticker for your profile.', 'companion', 10, 'https://i.imgur.com/7Tx4lp0.png', '{"url": "https://i.imgur.com/7Tx4lp0.png", "size": "80px"}', true
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Tanjiro' AND type = 'companion');

INSERT INTO shop_items (name, description, type, price, preview_url, css_data, is_active)
SELECT 'Gojo', 'A sleepy chibi Gojo companion. Still the strongest.', 'companion', 10, 'https://i.imgur.com/nS2Wtg8.png', '{"url": "https://i.imgur.com/nS2Wtg8.png", "size": "80px"}', true
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Gojo' AND type = 'companion');

INSERT INTO shop_items (name, description, type, price, preview_url, css_data, is_active)
SELECT 'Ribbon', 'A soft pink ribbon companion for your profile.', 'companion', 10, 'https://i.imgur.com/t4FOjt1.png', '{"url": "https://i.imgur.com/t4FOjt1.png", "size": "80px"}', true
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Ribbon' AND type = 'companion');

INSERT INTO shop_items (name, description, type, price, preview_url, css_data, is_active)
SELECT 'Obanai', 'Obanai Iguro with his white snake Kaburamaru on his head.', 'companion', 10, 'https://i.imgur.com/p660UAu.png', '{"url": "https://i.imgur.com/p660UAu.png", "size": "80px"}', true
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Obanai' AND type = 'companion');

INSERT INTO shop_items (name, description, type, price, preview_url, css_data, is_active)
SELECT 'Angry', 'A cheeky red hashtag-cross companion. Radiates chaos energy.', 'companion', 10, 'https://i.imgur.com/JNmDiw6.png', '{"url": "https://i.imgur.com/JNmDiw6.png", "size": "80px"}', true
WHERE NOT EXISTS (SELECT 1 FROM shop_items WHERE name = 'Angry' AND type = 'companion');
