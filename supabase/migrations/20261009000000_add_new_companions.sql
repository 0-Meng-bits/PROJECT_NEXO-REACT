-- Add new companion stickers
INSERT INTO shop_items (name, description, type, price, preview_url, css_data, is_active)
VALUES
  (
    'Kirby',
    'The pink puffball from Dream Land. Inhales your worries away.',
    'companion',
    10,
    'https://i.imgur.com/9EkRPUf.png',
    '{"url": "https://i.imgur.com/9EkRPUf.png", "size": "80px"}',
    true
  ),
  (
    'Blobby',
    'A cheeky little yellow gremlin sticking its tongue out at everyone.',
    'companion',
    10,
    'https://i.imgur.com/X0eOYWB.png',
    '{"url": "https://i.imgur.com/X0eOYWB.png", "size": "80px"}',
    true
  ),
  (
    'Zenitsu',
    'Zenitsu Agatsuma in full panic mode. Somehow still the best.',
    'companion',
    10,
    'https://i.imgur.com/oXAEEew.png',
    '{"url": "https://i.imgur.com/oXAEEew.png", "size": "80px"}',
    true
  ),
  (
    'Butterfly',
    'A delicate purple and pink butterfly companion for your profile.',
    'companion',
    10,
    'https://i.imgur.com/tEKMxUH.png',
    '{"url": "https://i.imgur.com/tEKMxUH.png", "size": "80px"}',
    true
  );
