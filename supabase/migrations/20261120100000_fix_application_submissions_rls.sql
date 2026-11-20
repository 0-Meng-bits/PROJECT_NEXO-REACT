-- application_submissions was renamed from audition_responses but the
-- RLS policies did not carry over after the rename. Add them back.
-- Same issue affects applications (was auditions) and application_questions
-- (was audition_questions).

-- ── application_submissions ──────────────────────────────────────────────
ALTER TABLE application_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read application_submissions"  ON application_submissions;
DROP POLICY IF EXISTS "Users can manage application_submissions" ON application_submissions;
DROP POLICY IF EXISTS "Anyone can read audition_responses"       ON application_submissions;
DROP POLICY IF EXISTS "Users can manage audition_responses"      ON application_submissions;

CREATE POLICY "Anyone can read application_submissions"
  ON application_submissions FOR SELECT USING (true);

CREATE POLICY "Users can manage application_submissions"
  ON application_submissions FOR ALL USING (true);

-- ── applications ─────────────────────────────────────────────────────────
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read applications"  ON applications;
DROP POLICY IF EXISTS "Users can manage applications" ON applications;

CREATE POLICY "Anyone can read applications"
  ON applications FOR SELECT USING (true);

CREATE POLICY "Users can manage applications"
  ON applications FOR ALL USING (true);

-- ── application_questions ─────────────────────────────────────────────────
ALTER TABLE application_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read application_questions"  ON application_questions;
DROP POLICY IF EXISTS "Users can manage application_questions" ON application_questions;

CREATE POLICY "Anyone can read application_questions"
  ON application_questions FOR SELECT USING (true);

CREATE POLICY "Users can manage application_questions"
  ON application_questions FOR ALL USING (true);
