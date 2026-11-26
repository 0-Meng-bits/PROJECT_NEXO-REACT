-- ============================================================
-- NEXO CONNECT — Incremental Normalization Migration
-- Date: 2026-11-26
-- Purpose: Safely migrate an existing live Supabase database to
--          the normalized schema without losing existing data.
-- ============================================================

-- ── 1. COMMUNITY_INTERESTS (replaces communities.interest_tag) ───────
CREATE TABLE IF NOT EXISTS community_interests (
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  interest     text NOT NULL,
  PRIMARY KEY (community_id, interest)
);
CREATE INDEX IF NOT EXISTS idx_community_interests_interest ON community_interests(interest);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'communities' AND column_name = 'interest_tag'
  ) THEN
    INSERT INTO community_interests (community_id, interest)
    SELECT c.id, TRIM(tag)
    FROM communities c,
         LATERAL regexp_split_to_table(c.interest_tag, ',') AS tag
    WHERE c.interest_tag IS NOT NULL AND TRIM(tag) <> ''
    ON CONFLICT DO NOTHING;

    ALTER TABLE communities DROP COLUMN interest_tag;
  END IF;
END $$;

ALTER TABLE community_interests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read community interests"      ON community_interests;
DROP POLICY IF EXISTS "Circle leaders manage community interests" ON community_interests;
DROP POLICY IF EXISTS "Service role full access"                  ON community_interests;
CREATE POLICY "Anyone can read community interests" ON community_interests FOR SELECT USING (true);
CREATE POLICY "Circle leaders manage community interests" ON community_interests FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM communities c WHERE c.id = community_id AND c.creator_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM communities c WHERE c.id = community_id AND c.creator_id = auth.uid()));
CREATE POLICY "Service role full access" ON community_interests TO service_role USING (true) WITH CHECK (true);


-- ── 2. ABUSE_PATTERN_FLAGGERS (replaces abuse_patterns.flagger_ids) ──
CREATE TABLE IF NOT EXISTS abuse_pattern_flaggers (
  pattern_id uuid NOT NULL REFERENCES abuse_patterns(id) ON DELETE CASCADE,
  flagger_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (pattern_id, flagger_id)
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'abuse_patterns' AND column_name = 'flagger_ids'
  ) THEN
    INSERT INTO abuse_pattern_flaggers (pattern_id, flagger_id)
    SELECT ap.id, fid
    FROM abuse_patterns ap,
         LATERAL UNNEST(ap.flagger_ids) AS fid
    WHERE ap.flagger_ids IS NOT NULL
      AND EXISTS (SELECT 1 FROM accounts a WHERE a.id = fid)
    ON CONFLICT DO NOTHING;

    ALTER TABLE abuse_patterns DROP COLUMN flagger_ids;
  END IF;
END $$;

ALTER TABLE abuse_pattern_flaggers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON abuse_pattern_flaggers;
CREATE POLICY "Service role full access" ON abuse_pattern_flaggers TO service_role USING (true) WITH CHECK (true);


-- ── 3. APPLICATION_QUESTION_OPTIONS (replaces jsonb options) ─────────
CREATE TABLE IF NOT EXISTS application_question_options (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   uuid NOT NULL REFERENCES application_questions(id) ON DELETE CASCADE,
  option_text   text NOT NULL,
  display_order int  DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_app_question_options_question ON application_question_options(question_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'application_questions' AND column_name = 'options'
  ) THEN
    INSERT INTO application_question_options (question_id, option_text, display_order)
    SELECT q.id, elem.val, (elem.ord - 1)::int
    FROM application_questions q,
         LATERAL jsonb_array_elements_text(q.options) WITH ORDINALITY AS elem(val, ord)
    WHERE q.options IS NOT NULL
      AND jsonb_typeof(q.options) = 'array'
      AND NOT EXISTS (SELECT 1 FROM application_question_options o WHERE o.question_id = q.id);

    ALTER TABLE application_questions DROP COLUMN options;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'application_questions' AND column_name = 'community_id'
  ) THEN
    ALTER TABLE application_questions DROP COLUMN community_id;
  END IF;
END $$;

ALTER TABLE application_question_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read application_question_options"    ON application_question_options;
DROP POLICY IF EXISTS "Leaders can manage application_question_options" ON application_question_options;
DROP POLICY IF EXISTS "Service role full access"                        ON application_question_options;
CREATE POLICY "Anyone can read application_question_options" ON application_question_options FOR SELECT USING (true);
CREATE POLICY "Leaders can manage application_question_options" ON application_question_options FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM application_questions q
      JOIN applications a ON a.id = q.application_id
      JOIN communities c ON c.id = a.community_id
      WHERE q.id = question_id
        AND (c.creator_id = auth.uid() OR EXISTS (
          SELECT 1 FROM memberships m WHERE m.community_id = c.id AND m.user_id = auth.uid() AND m.rank_level >= 1 AND m.status IN ('active', 'approved')
        ))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM application_questions q
      JOIN applications a ON a.id = q.application_id
      JOIN communities c ON c.id = a.community_id
      WHERE q.id = question_id
        AND (c.creator_id = auth.uid() OR EXISTS (
          SELECT 1 FROM memberships m WHERE m.community_id = c.id AND m.user_id = auth.uid() AND m.rank_level >= 1 AND m.status IN ('active', 'approved')
        ))
    )
  );
CREATE POLICY "Service role full access" ON application_question_options TO service_role USING (true) WITH CHECK (true);


-- ── 4. APPLICATION_ANSWERS (replaces jsonb answers) ──────────────────
CREATE TABLE IF NOT EXISTS application_answers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES application_submissions(id) ON DELETE CASCADE,
  question_id   uuid NOT NULL REFERENCES application_questions(id) ON DELETE CASCADE,
  answer_text   text,
  UNIQUE (submission_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_app_answers_submission ON application_answers(submission_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'application_submissions' AND column_name = 'answers'
  ) THEN
    INSERT INTO application_answers (submission_id, question_id, answer_text)
    SELECT s.id, kv.key::uuid, kv.value
    FROM application_submissions s,
         LATERAL jsonb_each_text(s.answers) AS kv(key, value)
    WHERE s.answers IS NOT NULL
      AND jsonb_typeof(s.answers) = 'object'
      AND kv.key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      AND EXISTS (SELECT 1 FROM application_questions q WHERE q.id = kv.key::uuid)
    ON CONFLICT (submission_id, question_id) DO NOTHING;

    ALTER TABLE application_submissions DROP COLUMN answers;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'application_submissions' AND column_name = 'community_id'
  ) THEN
    ALTER TABLE application_submissions DROP COLUMN community_id;
  END IF;
END $$;

ALTER TABLE application_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read own or circle application answers" ON application_answers;
DROP POLICY IF EXISTS "Applicants insert own answers"          ON application_answers;
DROP POLICY IF EXISTS "Service role full access"               ON application_answers;
CREATE POLICY "Read own or circle application answers" ON application_answers FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM application_submissions s
      WHERE s.id = submission_id
        AND (
          s.applicant_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM applications a
            JOIN communities c ON c.id = a.community_id
            WHERE a.id = s.application_id
              AND (c.creator_id = auth.uid() OR EXISTS (
                SELECT 1 FROM memberships m WHERE m.community_id = c.id AND m.user_id = auth.uid() AND m.rank_level >= 1 AND m.status IN ('active', 'approved')
              ))
          )
        )
    )
  );
CREATE POLICY "Applicants insert own answers" ON application_answers FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM application_submissions s WHERE s.id = submission_id AND s.applicant_id = auth.uid())
  );
CREATE POLICY "Service role full access" ON application_answers TO service_role USING (true) WITH CHECK (true);


-- ── 5. ANNOUNCEMENTS, POST_COMMENTS, MESSAGES 3NF CLEANUP ────────────
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS anonymous boolean DEFAULT false;
ALTER TABLE announcements DROP COLUMN IF EXISTS author_student_id;
ALTER TABLE announcements DROP CONSTRAINT IF EXISTS announcements_solution_comment_id_fkey;
ALTER TABLE announcements
  ADD CONSTRAINT announcements_solution_comment_id_fkey
    FOREIGN KEY (solution_comment_id) REFERENCES post_comments(id) ON DELETE SET NULL;

ALTER TABLE post_comments DROP COLUMN IF EXISTS author_name;
ALTER TABLE post_comments DROP COLUMN IF EXISTS author_type;

ALTER TABLE messages DROP COLUMN IF EXISTS full_name;


-- ── 6. FIX SHOWCASE_FEEDBACK UNIQUE CONSTRAINT ───────────────────────
ALTER TABLE showcase_feedback DROP CONSTRAINT IF EXISTS showcase_feedback_announcement_id_user_id_key;
ALTER TABLE showcase_feedback DROP CONSTRAINT IF EXISTS showcase_feedback_announcement_id_user_id_tag_type_key;
ALTER TABLE showcase_feedback
  ADD CONSTRAINT showcase_feedback_announcement_id_user_id_tag_type_key
    UNIQUE (announcement_id, user_id, tag_type);


-- ── 7. DROP UNUSED LEGACY PROFILES TABLE ─────────────────────────────
DROP TABLE IF EXISTS profiles;


-- ── 8. UPDATE detect_abuse_patterns() FOR ABUSE_PATTERN_FLAGGERS ─────
CREATE OR REPLACE FUNCTION detect_abuse_patterns()
RETURNS void AS $$
DECLARE
  rec record;
  new_pattern_id uuid;
BEGIN
  FOR rec IN
    SELECT community_id, flagged_user_id, ARRAY_AGG(DISTINCT flagger_id) AS flaggers
    FROM user_flags
    WHERE created_at > NOW() - INTERVAL '24 hours'
      AND status = 'pending'
    GROUP BY community_id, flagged_user_id
    HAVING COUNT(*) >= 3
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM abuse_patterns
      WHERE pattern_type = 'mass_flag_single_user'
        AND community_id IS NOT DISTINCT FROM rec.community_id
        AND target_user_id = rec.flagged_user_id
        AND status = 'reviewing'
    ) THEN
      INSERT INTO abuse_patterns (pattern_type, community_id, target_user_id, severity)
      VALUES ('mass_flag_single_user', rec.community_id, rec.flagged_user_id, 'high')
      RETURNING id INTO new_pattern_id;

      INSERT INTO abuse_pattern_flaggers (pattern_id, flagger_id)
      SELECT new_pattern_id, UNNEST(rec.flaggers)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  FOR rec IN
    SELECT flagged_user_id, ARRAY_AGG(DISTINCT flagger_id) AS flaggers
    FROM user_flags
    WHERE created_at > NOW() - INTERVAL '7 days'
      AND status = 'pending'
    GROUP BY flagged_user_id
    HAVING COUNT(*) >= 5
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM abuse_patterns
      WHERE pattern_type = 'rapid_succession'
        AND target_user_id = rec.flagged_user_id
        AND status = 'reviewing'
    ) THEN
      INSERT INTO abuse_patterns (pattern_type, target_user_id, severity)
      VALUES ('rapid_succession', rec.flagged_user_id, 'medium')
      RETURNING id INTO new_pattern_id;

      INSERT INTO abuse_pattern_flaggers (pattern_id, flagger_id)
      SELECT new_pattern_id, UNNEST(rec.flaggers)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

