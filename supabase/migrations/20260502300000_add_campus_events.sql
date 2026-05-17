-- Campus Events table
CREATE TABLE IF NOT EXISTS campus_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  event_date date NOT NULL,
  event_time text,
  location text,
  category text DEFAULT 'general' CHECK (category IN ('seminar', 'sports', 'cultural', 'academic', 'general')),
  poster_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  poster_name text,
  poster_type text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_date ON campus_events(event_date);

ALTER TABLE campus_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read events" ON campus_events;
CREATE POLICY "Anyone can read events" ON campus_events FOR SELECT USING (true);
DROP POLICY IF EXISTS "Verified users can post events" ON campus_events;
CREATE POLICY "Verified users can post events" ON campus_events FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Poster can delete own events" ON campus_events;
CREATE POLICY "Poster can delete own events" ON campus_events FOR DELETE USING (true);
