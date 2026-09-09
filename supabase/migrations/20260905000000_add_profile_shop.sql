-- ============================================================
-- PROFILE CUSTOMIZATION SHOP
-- Date: 2026-09-05
-- Purpose: Allow users to buy profile customizations with trust points
-- ============================================================

-- ── 1. SHOP ITEMS TABLE ──────────────────────────────────────
-- Store available customization items
CREATE TABLE IF NOT EXISTS shop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  type text NOT NULL CHECK (type IN ('theme', 'badge', 'background', 'name_color', 'music')),
  price int NOT NULL DEFAULT 0,
  preview_url text,
  css_data jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ── 2. USER PURCHASES TABLE ──────────────────────────────────
-- Track what users have bought
CREATE TABLE IF NOT EXISTS user_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  item_id uuid REFERENCES shop_items(id) ON DELETE CASCADE,
  purchased_at timestamptz DEFAULT now(),
  UNIQUE(user_id, item_id)
);

-- ── 3. USER PROFILE SETTINGS TABLE ───────────────────────────
-- Store user's active customizations
CREATE TABLE IF NOT EXISTS user_profile_settings (
  user_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  active_theme uuid REFERENCES shop_items(id),
  active_badge uuid REFERENCES shop_items(id),
  active_background uuid REFERENCES shop_items(id),
  active_name_color uuid REFERENCES shop_items(id),
  active_music uuid REFERENCES shop_items(id),
  updated_at timestamptz DEFAULT now()
);

-- ── 4. RLS POLICIES ──────────────────────────────────────────

-- Shop items: everyone can read
CREATE POLICY "Anyone can view shop items"
  ON shop_items FOR SELECT
  TO public
  USING (is_active = true);

-- User purchases: users can view their own purchases
CREATE POLICY "Users can view own purchases"
  ON user_purchases FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own purchases"
  ON user_purchases FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Profile settings: users can view and update their own
CREATE POLICY "Users can view own profile settings"
  ON user_profile_settings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile settings"
  ON user_profile_settings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile settings"
  ON user_profile_settings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 5. INDEXES ───────────────────────────────────────────────
CREATE INDEX idx_shop_items_type ON shop_items(type);
CREATE INDEX idx_shop_items_active ON shop_items(is_active);
CREATE INDEX idx_user_purchases_user ON user_purchases(user_id);
CREATE INDEX idx_user_purchases_item ON user_purchases(item_id);

-- ── 6. SEED DATA ─────────────────────────────────────────────
-- Add some default shop items

-- Themes
INSERT INTO shop_items (name, description, type, price, css_data) VALUES
  ('Cyber Blue', 'Classic neon blue theme', 'theme', 5, '{"primary": "#00f0ff", "secondary": "#0080ff", "gradient": "linear-gradient(135deg, #00f0ff, #0080ff)"}'),
  ('Sunset Orange', 'Warm sunset gradient', 'theme', 5, '{"primary": "#ff6b35", "secondary": "#f7931e", "gradient": "linear-gradient(135deg, #ff6b35, #f7931e)"}'),
  ('Neon Purple', 'Electric purple vibes', 'theme', 8, '{"primary": "#a855f7", "secondary": "#ec4899", "gradient": "linear-gradient(135deg, #a855f7, #ec4899)"}'),
  ('Matrix Green', 'Classic hacker aesthetic', 'theme', 8, '{"primary": "#00ff41", "secondary": "#00d930", "gradient": "linear-gradient(135deg, #00ff41, #00d930)"}');

-- Badges
INSERT INTO shop_items (name, description, type, price, preview_url) VALUES
  ('Star Badge', 'Golden star next to your name', 'badge', 3, '⭐'),
  ('Fire Badge', 'You''re on fire!', 'badge', 3, '🔥'),
  ('Crown Badge', 'Royal status', 'badge', 5, '👑'),
  ('Lightning Badge', 'Electric presence', 'badge', 4, '⚡'),
  ('Heart Badge', 'Spread the love', 'badge', 2, '💖');

-- Name Colors
INSERT INTO shop_items (name, description, type, price, css_data) VALUES
  ('Gold Name', 'Shiny gold username', 'name_color', 3, '{"color": "#ffd700"}'),
  ('Rainbow Name', 'Rainbow gradient username', 'name_color', 5, '{"gradient": "linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3)"}'),
  ('Neon Pink', 'Hot pink username', 'name_color', 3, '{"color": "#ff10f0"}'),
  ('Ice Blue', 'Cool blue username', 'name_color', 3, '{"color": "#00d4ff"}');

-- Backgrounds
INSERT INTO shop_items (name, description, type, price, css_data) VALUES
  ('Dots Pattern', 'Subtle dot pattern', 'background', 4, '{"pattern": "radial-gradient(circle, rgba(0,240,255,0.1) 1px, transparent 1px)", "size": "20px 20px"}'),
  ('Grid Pattern', 'Tech grid background', 'background', 4, '{"pattern": "linear-gradient(rgba(0,240,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.1) 1px, transparent 1px)", "size": "30px 30px"}'),
  ('Waves', 'Flowing wave pattern', 'background', 6, '{"image": "url(data:image/svg+xml,...)"}'),
  ('Stars', 'Starry night background', 'background', 5, '{"pattern": "radial-gradient(2px 2px at 20px 30px, white, transparent), radial-gradient(2px 2px at 60px 70px, white, transparent)"}');

-- ============================================================
-- DONE! Profile shop ready for users to buy customizations
-- ============================================================
