-- ============================================================
-- NEXO CONNECT — Schema Simplification Migration (51 -> 46 tables)
-- Date: 2026-11-26
-- Purpose: Safely migrate an existing live Supabase database:
--   1. Drop unused abuse_patterns & abuse_pattern_flaggers (-2)
--   2. Drop redundant appreciation_cooldowns (-1); query point_transactions instead
--   3. Fold login_streaks into account_details (-1)
--   4. Merge post_likes + showcase_feedback into post_reactions (-1)
-- ============================================================


-- ── 1. DROP UNUSED ABUSE_PATTERNS & ABUSE_PATTERN_FLAGGERS ───────────
DROP FUNCTION IF EXISTS detect_abuse_patterns();
DROP TABLE IF EXISTS abuse_pattern_flaggers;
DROP TABLE IF EXISTS abuse_patterns;


-- ── 2. DROP REDUNDANT APPRECIATION_COOLDOWNS ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_point_transactions_appreciation_cooldown
  ON point_transactions(from_user_id, user_id, created_at)
  WHERE transaction_type = 'appreciation';

CREATE OR REPLACE FUNCTION can_give_appreciation(p_giver_id uuid, p_receiver_id uuid)
RETURNS boolean AS $$
DECLARE last_given timestamptz;
BEGIN
  IF p_giver_id = p_receiver_id THEN RETURN false; END IF;
  SELECT MAX(created_at) INTO last_given
  FROM point_transactions
  WHERE transaction_type = 'appreciation'
    AND from_user_id = p_giver_id
    AND user_id = p_receiver_id;
  IF last_given IS NULL THEN RETURN true; END IF;
  RETURN NOW() - last_given >= INTERVAL '12 hours';
END;
$$ LANGUAGE plpgsql;

DROP TABLE IF EXISTS appreciation_cooldowns;


-- ── 3. FOLD LOGIN_STREAKS INTO ACCOUNT_DETAILS ───────────────────────
ALTER TABLE account_details
  ADD COLUMN IF NOT EXISTS streak_count    int  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login_date date,
  ADD COLUMN IF NOT EXISTS longest_streak  int  NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'login_streaks'
  ) THEN
    INSERT INTO account_details (id, streak_count, last_login_date, longest_streak)
    SELECT ls.user_id, ls.streak_count, ls.last_login_date, ls.longest_streak
    FROM login_streaks ls
    ON CONFLICT (id) DO UPDATE SET
      streak_count    = EXCLUDED.streak_count,
      last_login_date = EXCLUDED.last_login_date,
      longest_streak  = EXCLUDED.longest_streak;

    DROP TABLE login_streaks;
  END IF;
END $$;


-- ── 4. MERGE POST_LIKES + SHOWCASE_FEEDBACK INTO POST_REACTIONS ──────
CREATE TABLE IF NOT EXISTS post_reactions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid        NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  reaction_type   text        NOT NULL CHECK (reaction_type IN (
                                'like', 'effort', 'creative', 'technique', 'style', 'impact'
                              )),
  created_at      timestamptz DEFAULT now(),
  UNIQUE (announcement_id, user_id, reaction_type)
);
CREATE INDEX IF NOT EXISTS idx_post_reactions_announcement_id ON post_reactions(announcement_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_user_id         ON post_reactions(user_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'post_likes'
  ) THEN
    INSERT INTO post_reactions (announcement_id, user_id, reaction_type, created_at)
    SELECT announcement_id, user_id, 'like', created_at
    FROM post_likes
    ON CONFLICT (announcement_id, user_id, reaction_type) DO NOTHING;

    DROP TABLE post_likes;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'showcase_feedback'
  ) THEN
    INSERT INTO post_reactions (announcement_id, user_id, reaction_type, created_at)
    SELECT announcement_id, user_id, tag_type, created_at
    FROM showcase_feedback
    ON CONFLICT (announcement_id, user_id, reaction_type) DO NOTHING;

    DROP TABLE showcase_feedback;
  END IF;
END $$;

ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read post reactions"   ON post_reactions;
DROP POLICY IF EXISTS "Users manage own post reactions" ON post_reactions;
DROP POLICY IF EXISTS "Service role full access"        ON post_reactions;
CREATE POLICY "Anyone can read post reactions"   ON post_reactions FOR SELECT USING (true);
CREATE POLICY "Users manage own post reactions"  ON post_reactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service role full access"         ON post_reactions TO service_role USING (true) WITH CHECK (true);

