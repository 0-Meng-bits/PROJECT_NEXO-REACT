-- ── CAMPUS EVENTS TABLE ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campus_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  event_end_date date,
  event_time text,
  location text,
  category text DEFAULT 'general',
  poster_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  poster_name text DEFAULT 'CTU Administration',
  poster_type text DEFAULT 'Admin',
  is_official boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campus_events_date ON campus_events(event_date);
ALTER TABLE campus_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read events" ON campus_events;
CREATE POLICY "Anyone can read events" ON campus_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin and faculty can manage events" ON campus_events;
CREATE POLICY "Admin and faculty can manage events" ON campus_events FOR ALL USING (true);

-- ── PRE-SEED: CTU AY 2025-2026 ACADEMIC CALENDAR ─────────────────────────────

-- SEMESTER DATES
INSERT INTO campus_events (title, description, event_date, event_end_date, category, is_official, poster_name, poster_type) VALUES
('First Day of Actual Service', 'Faculty and staff report for duty', '2025-08-04', NULL, 'semester', true, 'CTU Administration', 'Admin'),
('Classes Start – 1st Semester', 'First Semester AY 2025-2026 begins', '2025-08-11', NULL, 'semester', true, 'CTU Administration', 'Admin'),
('Classes End – 1st Semester', 'Last day of classes for First Semester', '2025-12-11', NULL, 'semester', true, 'CTU Administration', 'Admin'),
('Classes Start – 2nd Semester', 'Second Semester AY 2025-2026 begins', '2026-01-12', NULL, 'semester', true, 'CTU Administration', 'Admin'),
('Classes End – 2nd Semester', 'Last day of classes for Second Semester', '2026-03-26', NULL, 'semester', true, 'CTU Administration', 'Admin'),
('Last Day of Service', 'End of academic year service', '2026-04-27', NULL, 'semester', true, 'CTU Administration', 'Admin'),
('Teachers Leave Duration', 'Faculty leave period', '2026-05-25', '2026-07-31', 'semester', true, 'CTU Administration', 'Admin'),

-- SUMMER
('Summer Classes Start', 'Summer term begins', '2026-06-03', NULL, 'semester', true, 'CTU Administration', 'Admin'),
('Summer Classes End', 'Summer term ends', '2026-07-11', NULL, 'semester', true, 'CTU Administration', 'Admin'),
('Graduation', 'Commencement Exercises AY 2025-2026', '2026-05-01', '2026-07-01', 'semester', true, 'CTU Administration', 'Admin'),

-- ENROLLMENT PERIODS
('Enrollment – 1st Year (1st Batch)', '1st Year students enrollment', '2025-05-12', '2025-05-30', 'enrollment', true, 'CTU Administration', 'Admin'),
('Enrollment – 1st Year (2nd Batch)', '1st Year students enrollment (2nd batch)', '2025-07-21', '2025-08-01', 'enrollment', true, 'CTU Administration', 'Admin'),
('Enrollment – 2nd Year', '2nd Year students enrollment', '2025-05-13', '2025-05-23', 'enrollment', true, 'CTU Administration', 'Admin'),
('Enrollment – 3rd Year', '3rd Year students enrollment', '2025-06-16', '2025-06-27', 'enrollment', true, 'CTU Administration', 'Admin'),
('Enrollment – 4th Year', '4th Year students enrollment', '2025-06-30', '2025-07-11', 'enrollment', true, 'CTU Administration', 'Admin'),
('Enrollment – 5th/6th Year', '5th and 6th Year students enrollment', '2025-07-14', '2025-07-25', 'enrollment', true, 'CTU Administration', 'Admin'),
('Late Enrollment / Adding-Dropping', 'Late enrollment and subject changes', '2025-07-28', '2025-08-01', 'enrollment', true, 'CTU Administration', 'Admin'),
('2nd Semester Enrollment – 1st Year', '1st Year 2nd semester enrollment', '2026-01-05', '2026-01-09', 'enrollment', true, 'CTU Administration', 'Admin'),
('2nd Semester Enrollment – 2nd Year', '2nd Year 2nd semester enrollment', '2026-01-05', '2026-01-09', 'enrollment', true, 'CTU Administration', 'Admin'),

-- EXAMINATION SCHEDULES
('Preliminary Exams – 1st Semester', 'Prelim examinations', '2025-09-15', '2025-09-21', 'exam', true, 'CTU Administration', 'Admin'),
('Midterm Exams – 1st Semester', 'Midterm examinations', '2025-10-20', '2025-10-26', 'exam', true, 'CTU Administration', 'Admin'),
('Semi-Final Exams – 1st Semester', 'Semi-final examinations', '2025-11-23', '2025-11-29', 'exam', true, 'CTU Administration', 'Admin'),
('Final Exams – 1st Semester', 'Final examinations', '2025-12-01', '2025-12-07', 'exam', true, 'CTU Administration', 'Admin'),
('Preliminary Exams – 2nd Semester', 'Prelim examinations', '2026-02-16', '2026-02-22', 'exam', true, 'CTU Administration', 'Admin'),
('Midterm Exams – 2nd Semester', 'Midterm examinations', '2026-03-23', '2026-03-29', 'exam', true, 'CTU Administration', 'Admin'),
('Semi-Final Exams – 2nd Semester', 'Semi-final examinations', '2026-04-27', '2026-05-03', 'exam', true, 'CTU Administration', 'Admin'),
('Final Exams – 2nd Semester (Graduating)', 'Final exams for graduating students', '2026-04-27', '2026-05-08', 'exam', true, 'CTU Administration', 'Admin'),
('Final Exams – 2nd Semester (Non-Graduating)', 'Final exams for non-graduating students', '2026-05-09', '2026-05-15', 'exam', true, 'CTU Administration', 'Admin'),

-- SEMESTRAL BREAKS
('Christmas Break', 'Semestral break / Christmas vacation', '2025-12-15', '2026-01-04', 'general', true, 'CTU Administration', 'Admin'),
('Summer Vacation', 'Summer break', '2026-05-25', '2026-07-31', 'general', true, 'CTU Administration', 'Admin'),

-- INTRAMURAL SPORTS
('Intramural Week', 'CTU Intramural Sports Week', '2025-11-03', '2025-11-09', 'sports', true, 'CTU Administration', 'Admin'),
('Cell Meet', 'Intramural Cell Meet', '2025-11-14', NULL, 'sports', true, 'CTU Administration', 'Admin'),
('Tri-Meet', 'Intramural Tri-Meet', '2025-11-26', '2025-11-28', 'sports', true, 'CTU Administration', 'Admin'),

-- NATIONAL HOLIDAYS
('Independence Day', 'Philippine Independence Day — Non-working holiday', '2025-06-12', NULL, 'holiday', true, 'CTU Administration', 'Admin'),
('Cebu Provincial Charter Day', 'Cebu Province founding anniversary — Special non-working day', '2025-08-06', NULL, 'holiday', true, 'CTU Administration', 'Admin'),
('Ninoy Aquino Day', 'National holiday', '2025-08-21', NULL, 'holiday', true, 'CTU Administration', 'Admin'),
('National Heroes Day', 'National holiday', '2025-08-25', NULL, 'holiday', true, 'CTU Administration', 'Admin'),
('Osmeña Day', 'President Sergio Osmeña Sr. Day — Special non-working day', '2025-09-09', NULL, 'holiday', true, 'CTU Administration', 'Admin'),
('All Saints Day', 'National holiday', '2025-11-01', NULL, 'holiday', true, 'CTU Administration', 'Admin'),
('CTU Foundation Anniversary', 'Cebu Technological University Foundation Day', '2025-11-03', NULL, 'general', true, 'CTU Administration', 'Admin'),
('Bonifacio Day', 'National holiday', '2025-11-30', NULL, 'holiday', true, 'CTU Administration', 'Admin'),
('Feast of the Immaculate Conception', 'National holiday', '2025-12-08', NULL, 'holiday', true, 'CTU Administration', 'Admin'),
('Christmas Eve', 'Special non-working day', '2025-12-24', NULL, 'holiday', true, 'CTU Administration', 'Admin'),
('Christmas Day', 'National holiday', '2025-12-25', NULL, 'holiday', true, 'CTU Administration', 'Admin'),
('Rizal Day', 'National holiday', '2025-12-30', NULL, 'holiday', true, 'CTU Administration', 'Admin'),
('Last Day of the Year', 'Special non-working day', '2025-12-31', NULL, 'holiday', true, 'CTU Administration', 'Admin'),
('New Year''s Day', 'National holiday', '2026-01-01', NULL, 'holiday', true, 'CTU Administration', 'Admin'),
('Sto. Niño Fiesta (Sinulog)', 'Cebu City Sinulog Festival — Special non-working day', '2026-01-18', NULL, 'cultural', true, 'CTU Administration', 'Admin'),
('Chinese New Year', 'Special non-working day', '2026-01-29', NULL, 'cultural', true, 'CTU Administration', 'Admin'),
('Cebu City Charter Day', 'Cebu City Charter Day — Special non-working day', '2026-02-24', NULL, 'holiday', true, 'CTU Administration', 'Admin'),
('Maundy Thursday', 'Holy Week — Special non-working day', '2026-04-02', NULL, 'holiday', true, 'CTU Administration', 'Admin'),
('Good Friday', 'Holy Week — National holiday', '2026-04-03', NULL, 'holiday', true, 'CTU Administration', 'Admin'),
('Black Saturday', 'Holy Week — Special non-working day', '2026-04-04', NULL, 'holiday', true, 'CTU Administration', 'Admin'),
('Easter Sunday', 'Easter Sunday', '2026-04-05', NULL, 'holiday', true, 'CTU Administration', 'Admin'),
('Araw ng Kagitingan', 'Day of Valor — National holiday', '2026-04-09', NULL, 'holiday', true, 'CTU Administration', 'Admin'),
('Labor Day', 'International Labor Day — National holiday', '2026-05-01', NULL, 'holiday', true, 'CTU Administration', 'Admin');
