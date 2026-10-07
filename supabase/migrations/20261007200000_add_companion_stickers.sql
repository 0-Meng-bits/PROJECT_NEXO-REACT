-- Add three new companion stickers
INSERT INTO shop_items (name, description, type, price, preview_url, css_data, is_active)
VALUES
  (
    'Chibi Companion 1',
    'A cute chibi companion sticker for your profile.',
    'companion',
    10,
    'https://i.imgur.com/w32kXoH.png',
    '{"url": "https://i.imgur.com/w32kXoH.png", "size": "64px"}',
    true
  ),
  (
    'Chibi Companion 2',
    'A cute chibi companion sticker for your profile.',
    'companion',
    10,
    'https://i.imgur.com/pblV7pI.png',
    '{"url": "https://i.imgur.com/pblV7pI.png", "size": "64px"}',
    true
  ),
  (
    'Chibi Companion 3',
    'A cute chibi companion sticker for your profile.',
    'companion',
    10,
    'https://i.imgur.com/wE0PHNZ.png',
    '{"url": "https://i.imgur.com/wE0PHNZ.png", "size": "64px"}',
    true
  );
