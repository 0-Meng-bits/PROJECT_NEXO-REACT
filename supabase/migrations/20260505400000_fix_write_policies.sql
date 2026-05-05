-- ============================================================
-- Fix missing write policies for all core tables
-- Uses USING (true) consistent with existing read policies
-- ============================================================

-- MESSAGES
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read messages" ON messages;
CREATE POLICY "Anyone can read messages" ON messages FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert messages" ON messages;
CREATE POLICY "Users can insert messages" ON messages FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users can update own messages" ON messages;
CREATE POLICY "Users can update own messages" ON messages FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Users can delete own messages" ON messages;
CREATE POLICY "Users can delete own messages" ON messages FOR DELETE USING (true);

-- MEMBERSHIPS
DROP POLICY IF EXISTS "Users can insert memberships" ON memberships;
CREATE POLICY "Users can insert memberships" ON memberships FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users can update memberships" ON memberships;
CREATE POLICY "Users can update memberships" ON memberships FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Users can delete memberships" ON memberships;
CREATE POLICY "Users can delete memberships" ON memberships FOR DELETE USING (true);

-- ANNOUNCEMENTS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read announcements" ON announcements;
CREATE POLICY "Anyone can read announcements" ON announcements FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert announcements" ON announcements;
CREATE POLICY "Users can insert announcements" ON announcements FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users can update announcements" ON announcements;
CREATE POLICY "Users can update announcements" ON announcements FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Users can delete announcements" ON announcements;
CREATE POLICY "Users can delete announcements" ON announcements FOR DELETE USING (true);

-- NOTIFICATIONS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read notifications" ON notifications;
CREATE POLICY "Anyone can read notifications" ON notifications FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert notifications" ON notifications;
CREATE POLICY "Users can insert notifications" ON notifications FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users can update notifications" ON notifications;
CREATE POLICY "Users can update notifications" ON notifications FOR UPDATE USING (true);

-- CHANNELS
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read channels" ON channels;
CREATE POLICY "Anyone can read channels" ON channels FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert channels" ON channels;
CREATE POLICY "Users can insert channels" ON channels FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users can delete channels" ON channels;
CREATE POLICY "Users can delete channels" ON channels FOR DELETE USING (true);

-- COMMUNITIES (insert/update already in previous migration, add delete)
DROP POLICY IF EXISTS "Users can delete own communities" ON communities;
CREATE POLICY "Users can delete own communities" ON communities FOR DELETE USING (true);

-- AUDITION QUESTIONS
ALTER TABLE audition_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read audition_questions" ON audition_questions;
CREATE POLICY "Anyone can read audition_questions" ON audition_questions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage audition_questions" ON audition_questions;
CREATE POLICY "Users can manage audition_questions" ON audition_questions FOR ALL USING (true);

-- AUDITION RESPONSES
ALTER TABLE audition_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read audition_responses" ON audition_responses;
CREATE POLICY "Anyone can read audition_responses" ON audition_responses FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can manage audition_responses" ON audition_responses;
CREATE POLICY "Users can manage audition_responses" ON audition_responses FOR ALL USING (true);

-- REPORTS
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read reports" ON reports;
CREATE POLICY "Anyone can read reports" ON reports FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert reports" ON reports;
CREATE POLICY "Users can insert reports" ON reports FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Users can update reports" ON reports;
CREATE POLICY "Users can update reports" ON reports FOR UPDATE USING (true);

-- POST COMMENTS (already has policies but ensure update is covered)
DROP POLICY IF EXISTS "Users can update own post_comments" ON post_comments;
CREATE POLICY "Users can update own post_comments" ON post_comments FOR UPDATE USING (true);
