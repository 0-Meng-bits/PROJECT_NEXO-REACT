-- Deletion warning system
-- Adds soft-delete / warning-before-delete state to accounts and communities.
-- When admin flags an account/circle for deletion:
--   1. deletion_pending = true, reason + deadline stored
--   2. User gets notified and has 7 days to appeal via support ticket
--   3. Admin can confirm (hard delete) or dismiss (clear the flag)

-- ── accounts / account_status ────────────────────────────────────────────────
ALTER TABLE account_status
  ADD COLUMN IF NOT EXISTS deletion_pending     boolean   DEFAULT false,
  ADD COLUMN IF NOT EXISTS deletion_reason      text,
  ADD COLUMN IF NOT EXISTS deletion_flagged_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_deadline    timestamptz;

-- ── communities ───────────────────────────────────────────────────────────────
ALTER TABLE communities
  ADD COLUMN IF NOT EXISTS deletion_pending     boolean   DEFAULT false,
  ADD COLUMN IF NOT EXISTS deletion_reason      text,
  ADD COLUMN IF NOT EXISTS deletion_flagged_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deletion_deadline    timestamptz;

-- ── support_tickets — add Deletion Appeal category ────────────────────────────
-- The existing CHECK only allows 5 categories; drop and recreate it to include
-- 'Deletion Appeal' so users can appeal their flagged account/circle.
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
