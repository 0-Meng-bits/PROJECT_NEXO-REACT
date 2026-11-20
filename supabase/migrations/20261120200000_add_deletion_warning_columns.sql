-- ── DELETION WARNINGS TABLE ──────────────────────────────────────────────────
-- Normalized replacement for the 8 columns that were previously spread across
-- account_status (deletion_pending, deletion_reason, deletion_flagged_at,
-- deletion_deadline) and communities (same 4 columns).
--
-- A single deletion_warnings table owns all deletion warning data.
-- target_type + target_id form a polymorphic reference:
--   target_type = 'account'   → target_id references accounts.id
--   target_type = 'community' → target_id references communities.id
--
-- Relationships:
--   deletion_warnings.flagged_by → accounts.id  (Many:1)
--   deletion_warnings.target_id  → accounts.id OR communities.id  (Many:1, polymorphic)
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the 8 columns added in a prior step (safe with IF EXISTS)
ALTER TABLE account_status
  DROP COLUMN IF EXISTS deletion_pending,
  DROP COLUMN IF EXISTS deletion_reason,
  DROP COLUMN IF EXISTS deletion_flagged_at,
  DROP COLUMN IF EXISTS deletion_deadline;

ALTER TABLE communities
  DROP COLUMN IF EXISTS deletion_pending,
  DROP COLUMN IF EXISTS deletion_reason,
  DROP COLUMN IF EXISTS deletion_flagged_at,
  DROP COLUMN IF EXISTS deletion_deadline;

-- Create the normalized table
CREATE TABLE IF NOT EXISTS deletion_warnings (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type   text        NOT NULL CHECK (target_type IN ('account', 'community')),
  target_id     uuid        NOT NULL,
  reason        text        NOT NULL,
  flagged_by    uuid        REFERENCES accounts(id) ON DELETE SET NULL,
  flagged_at    timestamptz NOT NULL DEFAULT now(),
  deadline      timestamptz NOT NULL,
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  resolved_at   timestamptz,
  UNIQUE (target_type, target_id, status)   -- only one active warning per target
);

CREATE INDEX IF NOT EXISTS idx_deletion_warnings_target ON deletion_warnings(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_deletion_warnings_status ON deletion_warnings(status);

ALTER TABLE deletion_warnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access deletion_warnings"
  ON deletion_warnings TO service_role USING (true) WITH CHECK (true);

-- ── support_tickets — add Deletion Appeal category ───────────────────────────
-- Drop and recreate CHECK to include 'Deletion Appeal' and also 'Ban Appeal' /
-- 'Suspension Appeal' which were already being inserted by the backend.
ALTER TABLE support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_category_check;

ALTER TABLE support_tickets
  ADD CONSTRAINT support_tickets_category_check
    CHECK (category IN (
      'Bug Report',
      'Account Issue',
      'General Question',
      'Circle Problem',
      'Other',
      'Ban Appeal',
      'Suspension Appeal',
      'Deletion Appeal'
    ));
