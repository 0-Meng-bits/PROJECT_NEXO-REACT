-- ============================================================
-- Migration: Rename course -> program, student_id -> sender_id
-- Date: 2026-10-18
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Rename course -> program in account_details
ALTER TABLE account_details RENAME COLUMN course TO program;

-- 2. Rename student_id -> sender_id in messages
ALTER TABLE messages RENAME COLUMN student_id TO sender_id;

-- 3. Rename student_id -> sender_id in message_reactions
ALTER TABLE message_reactions RENAME COLUMN student_id TO sender_id;

-- Done.
