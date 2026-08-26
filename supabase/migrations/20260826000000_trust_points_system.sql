-- ══════════════════════════════════════════════════════════════════════
-- TRUST POINTS & MODERATION SYSTEM
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. UPDATE USER_WARNINGS TABLE ──────────────────────────────────────
-- Add more detailed tracking for warnings
ALTER TABLE user_warnings ADD COLUMN IF NOT EXISTS severity text DEFAULT 'minor' 
  CHECK (severity IN ('minor', 'moderate', 'severe', 'critical'));
ALTER TABLE user_warnings ADD COLUMN IF NOT EXISTS points_deducted int DEFAULT 0;
ALTER TABLE user_warnings ADD COLUMN IF NOT EXISTS community_id uuid REFERENCES communities(id) ON DELETE SET NULL;
ALTER TABLE user_warnings ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' 
  CHECK (status IN ('active', 'appealed', 'overturned', 'expired'));
ALTER TABLE user_warnings ADD COLUMN IF NOT EXISTS appeal_reason text;
ALTER TABLE user_warnings ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES accounts(id);
ALTER TABLE user_warnings ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- ── 2. POINT TRANSACTIONS TABLE ────────────────────────────────────────
-- Track all point changes (warnings, appreciations, auto-recovery)
CREATE TABLE IF NOT EXISTS point_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount decimal(4,1) NOT NULL, -- Can be negative (warnings) or positive (appreciation)
  transaction_type text NOT NULL CHECK (transaction_type IN (
    'warning',           -- Admin issued warning
    'appreciation',      -- Peer gave points
    'daily_recovery',    -- Auto +0.5 daily
    'appeal_approved',   -- Points restored + bonus
    'admin_bonus',       -- Manual admin bonus
    'harassment_penalty' -- Penalty for false reports
  )),
  from_user_id uuid REFERENCES accounts(id), -- Who gave the points (for appreciation)
  community_id uuid REFERENCES communities(id), -- Which circle (if applicable)
  reason text,
  reference_id uuid, -- Links to warning_id or appeal_id
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_point_transactions_user ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_date ON point_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type ON point_transactions(transaction_type);

-- ── 3. APPRECIATION COOLDOWNS ───────────────────────────────────────────
-- Track who can give points to whom (prevent spam)
CREATE TABLE IF NOT EXISTS appreciation_cooldowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  giver_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  given_at timestamptz DEFAULT now(),
  UNIQUE(giver_id, receiver_id, given_at) -- Prevent exact duplicates
);

CREATE INDEX IF NOT EXISTS idx_cooldowns_giver ON appreciation_cooldowns(giver_id, given_at);
CREATE INDEX IF NOT EXISTS idx_cooldowns_receiver ON appreciation_cooldowns(receiver_id);

-- ── 4. USER FLAGS TABLE ─────────────────────────────────────────────────
-- Circle leaders flag users for admin review (not direct warnings)
CREATE TABLE IF NOT EXISTS user_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flagged_user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  flagger_id uuid NOT NULL REFERENCES accounts(id),
  community_id uuid REFERENCES communities(id) ON DELETE CASCADE,
  reason text NOT NULL,
  severity text DEFAULT 'moderate' CHECK (severity IN ('minor', 'moderate', 'severe', 'critical')),
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed', 'warning_issued')),
  admin_notes text,
  reviewed_by uuid REFERENCES accounts(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flags_user ON user_flags(flagged_user_id);
CREATE INDEX IF NOT EXISTS idx_flags_status ON user_flags(status);
CREATE INDEX IF NOT EXISTS idx_flags_community ON user_flags(community_id);

-- ── 5. APPEALS TABLE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warning_appeals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  warning_id uuid NOT NULL REFERENCES user_warnings(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  appeal_reason text NOT NULL,
  evidence text, -- User can provide context/screenshots
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  admin_decision text,
  reviewed_by uuid REFERENCES accounts(id),
  reviewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appeals_warning ON warning_appeals(warning_id);
CREATE INDEX IF NOT EXISTS idx_appeals_status ON warning_appeals(status);
CREATE INDEX IF NOT EXISTS idx_appeals_user ON warning_appeals(user_id);

-- ── 6. ABUSE PATTERN DETECTION ──────────────────────────────────────────
-- Track suspicious reporting patterns
CREATE TABLE IF NOT EXISTS abuse_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type text NOT NULL CHECK (pattern_type IN (
    'mass_flag_single_user',    -- Multiple flags on one user
    'coordinated_flagging',     -- Same group flags together
    'rapid_succession',         -- Too many flags too fast
    'circle_harassment'         -- Circle targeting user
  )),
  community_id uuid REFERENCES communities(id),
  target_user_id uuid REFERENCES accounts(id),
  flagger_ids uuid[], -- Array of user IDs involved
  detected_at timestamptz DEFAULT now(),
  severity text DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
  status text DEFAULT 'reviewing' CHECK (status IN ('reviewing', 'confirmed', 'false_alarm')),
  admin_notes text
);

CREATE INDEX IF NOT EXISTS idx_abuse_target ON abuse_patterns(target_user_id);
CREATE INDEX IF NOT EXISTS idx_abuse_community ON abuse_patterns(community_id);
CREATE INDEX IF NOT EXISTS idx_abuse_status ON abuse_patterns(status);

-- ── 7. UPDATE ACCOUNT_STATUS DEFAULTS ───────────────────────────────────
-- Ensure trust_points starts at 10
ALTER TABLE account_status ALTER COLUMN trust_points SET DEFAULT 10;

-- Update existing users to have 10 if they have 0
UPDATE account_status SET trust_points = 10 WHERE trust_points = 0;

-- ── 8. ROW LEVEL SECURITY ───────────────────────────────────────────────

ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE appreciation_cooldowns ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE warning_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE abuse_patterns ENABLE ROW LEVEL SECURITY;

-- Users can read their own point transactions
DROP POLICY IF EXISTS "Users can read own transactions" ON point_transactions;
CREATE POLICY "Users can read own transactions" ON point_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can read their own cooldowns
DROP POLICY IF EXISTS "Users can read own cooldowns" ON appreciation_cooldowns;
CREATE POLICY "Users can read own cooldowns" ON appreciation_cooldowns
  FOR SELECT USING (auth.uid() = giver_id OR auth.uid() = receiver_id);

-- Users can insert appreciation cooldowns (when giving points)
DROP POLICY IF EXISTS "Users can insert cooldowns" ON appreciation_cooldowns;
CREATE POLICY "Users can insert cooldowns" ON appreciation_cooldowns
  FOR INSERT WITH CHECK (auth.uid() = giver_id);

-- Users can read flags about themselves
DROP POLICY IF EXISTS "Users can read own flags" ON user_flags;
CREATE POLICY "Users can read own flags" ON user_flags
  FOR SELECT USING (auth.uid() = flagged_user_id);

-- Circle leaders can create flags
DROP POLICY IF EXISTS "Leaders can create flags" ON user_flags;
CREATE POLICY "Leaders can create flags" ON user_flags
  FOR INSERT WITH CHECK (auth.uid() = flagger_id);

-- Users can read their own appeals
DROP POLICY IF EXISTS "Users can read own appeals" ON warning_appeals;
CREATE POLICY "Users can read own appeals" ON warning_appeals
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create appeals
DROP POLICY IF EXISTS "Users can create appeals" ON warning_appeals;
CREATE POLICY "Users can create appeals" ON warning_appeals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Only admins can see abuse patterns (handled in app layer)

-- ══════════════════════════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ══════════════════════════════════════════════════════════════════════

-- Function to calculate current trust points for a user
CREATE OR REPLACE FUNCTION get_user_trust_points(target_user_id uuid)
RETURNS decimal(4,1) AS $$
DECLARE
  total_points decimal(4,1);
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total_points
  FROM point_transactions
  WHERE user_id = target_user_id;
  
  -- Clamp between 0 and 20
  IF total_points < 0 THEN
    total_points := 0;
  ELSIF total_points > 20 THEN
    total_points := 20;
  END IF;
  
  RETURN total_points;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user can give appreciation (cooldown check)
CREATE OR REPLACE FUNCTION can_give_appreciation(
  p_giver_id uuid,
  p_receiver_id uuid
)
RETURNS boolean AS $$
DECLARE
  last_given timestamptz;
BEGIN
  -- Can't give to yourself
  IF p_giver_id = p_receiver_id THEN
    RETURN false;
  END IF;
  
  -- Check cooldown (12 hours)
  SELECT MAX(given_at) INTO last_given
  FROM appreciation_cooldowns
  WHERE giver_id = p_giver_id AND receiver_id = p_receiver_id;
  
  IF last_given IS NULL THEN
    RETURN true;
  END IF;
  
  IF NOW() - last_given >= INTERVAL '12 hours' THEN
    RETURN true;
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function to detect abuse patterns
CREATE OR REPLACE FUNCTION detect_abuse_patterns()
RETURNS void AS $$
BEGIN
  -- Mass flagging: 3+ flags on same user from same community in 24h
  INSERT INTO abuse_patterns (pattern_type, community_id, target_user_id, flagger_ids, severity)
  SELECT 
    'mass_flag_single_user',
    community_id,
    flagged_user_id,
    ARRAY_AGG(DISTINCT flagger_id),
    'high'
  FROM user_flags
  WHERE created_at > NOW() - INTERVAL '24 hours'
    AND status = 'pending'
  GROUP BY community_id, flagged_user_id
  HAVING COUNT(*) >= 3
  ON CONFLICT DO NOTHING;
  
  -- Rapid succession: Same user flagged 5+ times in 7 days
  INSERT INTO abuse_patterns (pattern_type, target_user_id, flagger_ids, severity)
  SELECT 
    'rapid_succession',
    flagged_user_id,
    ARRAY_AGG(DISTINCT flagger_id),
    'medium'
  FROM user_flags
  WHERE created_at > NOW() - INTERVAL '7 days'
    AND status = 'pending'
  GROUP BY flagged_user_id
  HAVING COUNT(*) >= 5
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════════════════════════════
-- INITIAL DATA
-- ══════════════════════════════════════════════════════════════════════

-- Give all existing users initial 10 trust points transaction
INSERT INTO point_transactions (user_id, amount, transaction_type, reason)
SELECT 
  id,
  10.0,
  'admin_bonus',
  'Initial trust points for existing user'
FROM accounts
WHERE id NOT IN (SELECT user_id FROM point_transactions)
ON CONFLICT DO NOTHING;
