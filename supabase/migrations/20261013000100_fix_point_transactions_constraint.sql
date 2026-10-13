-- Fix point_transactions CHECK constraint to include 'welcome_bonus'
-- This type is used by verify-student.js when approving new accounts
ALTER TABLE point_transactions
  DROP CONSTRAINT IF EXISTS point_transactions_transaction_type_check;

ALTER TABLE point_transactions
  ADD CONSTRAINT point_transactions_transaction_type_check
    CHECK (transaction_type IN (
      'warning', 'appreciation', 'daily_recovery',
      'appeal_approved', 'admin_bonus', 'harassment_penalty',
      'welcome_bonus'
    ));
