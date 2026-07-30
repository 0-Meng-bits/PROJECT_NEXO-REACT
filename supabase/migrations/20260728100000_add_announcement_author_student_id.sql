ALTER TABLE announcements ADD COLUMN IF NOT EXISTS author_student_id text REFERENCES profiles(student_id);
