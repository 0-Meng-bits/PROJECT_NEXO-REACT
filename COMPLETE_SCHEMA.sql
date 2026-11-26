-- ============================================================
-- NEXO CONNECT — Complete Current Database Schema (Normalized)
-- Last updated: 2026-11-26
-- Purpose: Authoritative full schema for fresh Supabase setup
-- ============================================================


-- ── 1. ACCOUNTS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ctu_id     text        UNIQUE NOT NULL,
  full_name  text        NOT NULL,
  email      text        UNIQUE,
  user_type  text        DEFAULT 'Student' CHECK (user_type IN ('Student', 'Faculty', 'Admin')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own account"   ON accounts;
DROP POLICY IF EXISTS "Users can update own account" ON accounts;
CREATE POLICY "Users can read own account"   ON accounts FOR SELECT USING (true);
CREATE POLICY "Users can update own account" ON accounts FOR UPDATE USING (auth.uid() = id);


-- ── 2. ACCOUNT_STATUS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_status (
  id              uuid         PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  is_verified     boolean      DEFAULT false,
  is_banned       boolean      DEFAULT false,
  suspended_until timestamptz,
  warning_count   int          DEFAULT 0,
  trust_points    decimal(4,1) DEFAULT 10
);
ALTER TABLE account_status ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own status" ON account_status;
CREATE POLICY "Users can read own status" ON account_status FOR SELECT USING (true);


-- ── 3. ACCOUNT_DETAILS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_details (
  id                  uuid        PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  program             text,
  year_level          text,
  avatar_url          text,
  cover_url           text,
  id_photo_url        text,
  id_verified         boolean     DEFAULT false,
  last_seen           timestamptz,
  onboarding_complete boolean     DEFAULT false,
  gender              text        CHECK (gender IN ('Male', 'Female', 'Prefer not to say')),
  discoverable        boolean     NOT NULL DEFAULT true,
  bio                 text,
  streak_count        int         NOT NULL DEFAULT 0,
  last_login_date     date,
  longest_streak      int         NOT NULL DEFAULT 0
);
ALTER TABLE account_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own details"   ON account_details;
DROP POLICY IF EXISTS "Users can update own details" ON account_details;
DROP POLICY IF EXISTS "Users can insert own profile" ON account_details;
CREATE POLICY "Users can read own details"   ON account_details FOR SELECT USING (true);
CREATE POLICY "Users can update own details" ON account_details FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON account_details FOR INSERT WITH CHECK (auth.uid() = id);


-- ── 4. USER_INTERESTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_interests (
  user_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  interest text NOT NULL,
  PRIMARY KEY (user_id, interest)
);
ALTER TABLE user_interests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read interests"   ON user_interests;
DROP POLICY IF EXISTS "Users can manage interests" ON user_interests;
CREATE POLICY "Users can read interests"   ON user_interests FOR SELECT USING (true);
CREATE POLICY "Users can manage interests" ON user_interests FOR ALL    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ── 5. COMMUNITIES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS communities (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text        NOT NULL,
  description          text,
  category             text,
  icon                 text,
  creator_id           uuid        REFERENCES accounts(id) ON DELETE CASCADE,
  is_official          boolean     DEFAULT false,
  application_enabled  boolean     DEFAULT false,
  internal_application boolean     DEFAULT false,
  logo_url             text,
  cover_url            text,
  is_open              boolean     NOT NULL DEFAULT false,
  status               text        NOT NULL DEFAULT 'active'
                                   CHECK (status IN ('pending', 'active')),
  created_at           timestamptz DEFAULT now()
);
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read communities" ON communities;
CREATE POLICY "Anyone can read communities" ON communities FOR SELECT TO authenticated USING (true);


-- ── 6. COMMUNITY_INTERESTS ───────────────────────────────────────────
-- 1NF junction table (replaces comma-separated communities.interest_tag)
CREATE TABLE IF NOT EXISTS community_interests (
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  interest     text NOT NULL,
  PRIMARY KEY (community_id, interest)
);
CREATE INDEX IF NOT EXISTS idx_community_interests_interest ON community_interests(interest);
ALTER TABLE community_interests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read community interests"      ON community_interests;
DROP POLICY IF EXISTS "Circle leaders manage community interests" ON community_interests;
CREATE POLICY "Anyone can read community interests" ON community_interests FOR SELECT USING (true);
CREATE POLICY "Circle leaders manage community interests" ON community_interests FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM communities c
      WHERE c.id = community_id AND c.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM communities c
      WHERE c.id = community_id AND c.creator_id = auth.uid()
    )
  );


-- ── 7. MEMBERSHIPS ───────────────────────────────────────────────────
-- rank_level: 0=Member 1=Moderator 2=Co-Leader 3=Leader/Founder
CREATE TABLE IF NOT EXISTS memberships (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        REFERENCES accounts(id) ON DELETE CASCADE,
  community_id uuid        REFERENCES communities(id) ON DELETE CASCADE,
  rank_level   int         DEFAULT 0,
  status       text        DEFAULT 'pending',
  project_role text        CHECK (project_role IN ('Leader','Developer','Designer','Tester','Other')),
  created_at   timestamptz DEFAULT now(),
  UNIQUE (user_id, community_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_user_id      ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_community_id ON memberships(community_id);
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read memberships"                  ON memberships;
DROP POLICY IF EXISTS "Users can request membership"                 ON memberships;
DROP POLICY IF EXISTS "Users can delete own membership"              ON memberships;
DROP POLICY IF EXISTS "Community leaders can update member roles"    ON memberships;
CREATE POLICY "Anyone can read memberships" ON memberships FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can request membership" ON memberships FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own membership" ON memberships FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM memberships caller
      WHERE caller.user_id = auth.uid()
        AND caller.community_id = memberships.community_id
        AND caller.rank_level >= 1
        AND caller.status IN ('active', 'approved')
    )
  );
CREATE POLICY "Community leaders can update member roles" ON memberships FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM memberships caller
      WHERE caller.user_id = auth.uid()
        AND caller.community_id = memberships.community_id
        AND caller.rank_level >= 1
        AND caller.status IN ('active', 'approved')
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM memberships caller
      WHERE caller.user_id = auth.uid()
        AND caller.community_id = memberships.community_id
        AND caller.rank_level >= 1
        AND caller.status IN ('active', 'approved')
    )
  );


-- ── 8. CHANNELS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS channels (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid        REFERENCES communities(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  description  text,
  created_by   uuid        REFERENCES accounts(id),
  channel_type text        DEFAULT 'chat'
                           CHECK (channel_type IN ('chat','gallery','files','notes','tasks','voice')),
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_channels_type ON channels(channel_type);
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Circle members can read channels"  ON channels;
DROP POLICY IF EXISTS "Circle leaders manage channels"    ON channels;
CREATE POLICY "Circle members can read channels" ON channels FOR SELECT TO authenticated USING (true);
CREATE POLICY "Circle leaders manage channels" ON channels FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM communities c WHERE c.id = community_id AND c.creator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM memberships m WHERE m.community_id = channels.community_id AND m.user_id = auth.uid() AND m.rank_level >= 1 AND m.status IN ('active', 'approved')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM communities c WHERE c.id = community_id AND c.creator_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM memberships m WHERE m.community_id = channels.community_id AND m.user_id = auth.uid() AND m.rank_level >= 1 AND m.status IN ('active', 'approved')
    )
  );


-- ── 9. CIRCLE_REQUESTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS circle_requests (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text        NOT NULL,
  description  text        DEFAULT '',
  category     text        DEFAULT 'academic',
  icon         text        DEFAULT 'fa-solid fa-graduation-cap',
  creator_id   uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note   text        DEFAULT '',
  interest_tag text,
  is_open      boolean     NOT NULL DEFAULT false,
  logo_url     text,
  created_at   timestamptz DEFAULT now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid        REFERENCES accounts(id)
);
ALTER TABLE circle_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can create circle requests"   ON circle_requests;
DROP POLICY IF EXISTS "Users can view own circle requests" ON circle_requests;
DROP POLICY IF EXISTS "Admins can update circle requests"  ON circle_requests;
CREATE POLICY "Users can create circle requests"   ON circle_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Users can view own circle requests" ON circle_requests FOR SELECT TO authenticated
  USING (
    auth.uid() = creator_id
    OR EXISTS (SELECT 1 FROM accounts WHERE id = auth.uid() AND user_type = 'Admin')
  );
CREATE POLICY "Admins can update circle requests"  ON circle_requests FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM accounts WHERE id = auth.uid() AND user_type = 'Admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM accounts WHERE id = auth.uid() AND user_type = 'Admin'));


-- ── 10. CIRCLE_REQUEST_INVITEES ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS circle_request_invitees (
  request_id uuid NOT NULL REFERENCES circle_requests(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  PRIMARY KEY (request_id, user_id)
);
ALTER TABLE circle_request_invitees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view circle request invitees" ON circle_request_invitees;
CREATE POLICY "Users can view circle request invitees" ON circle_request_invitees FOR SELECT TO authenticated USING (true);


-- ── 11. MESSAGES ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id        text        REFERENCES accounts(ctu_id) ON DELETE CASCADE,
  content          text        NOT NULL,
  community_id     uuid        REFERENCES communities(id) ON DELETE CASCADE,
  channel_id       uuid        REFERENCES channels(id) ON DELETE CASCADE,
  role             text        DEFAULT 'MEMBER',
  edited           boolean     DEFAULT false,
  message_type     text        DEFAULT 'text'
                               CHECK (message_type IN ('text','image','video','voice','file','shoutout')),
  media_url        text,
  media_size       bigint,
  media_duration   int,
  reply_to_id      uuid        REFERENCES messages(id) ON DELETE SET NULL,
  reply_to_preview text,
  reply_to_author  text,
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_community_id ON messages(community_id);
CREATE INDEX IF NOT EXISTS idx_messages_channel_id   ON messages(channel_id);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can read messages"   ON messages;
DROP POLICY IF EXISTS "Authenticated users can insert messages" ON messages;
DROP POLICY IF EXISTS "Senders or admins can update messages"   ON messages;
DROP POLICY IF EXISTS "Senders or admins can delete messages"   ON messages;
CREATE POLICY "Authenticated users can read messages"   ON messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert messages" ON messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Senders or admins can update messages"   ON messages FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM accounts WHERE id = auth.uid() AND (ctu_id = messages.sender_id OR user_type = 'Admin'))
  );
CREATE POLICY "Senders or admins can delete messages"   ON messages FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM accounts WHERE id = auth.uid() AND (ctu_id = messages.sender_id OR user_type = 'Admin'))
  );


-- ── 12. MESSAGE_REACTIONS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_reactions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid        REFERENCES messages(id) ON DELETE CASCADE,
  sender_id  text        REFERENCES accounts(ctu_id) ON DELETE CASCADE,
  reaction   text        NOT NULL CHECK (reaction IN ('heart','laugh','sad','fire','wow')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (message_id, sender_id, reaction)
);
CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON message_reactions(message_id);
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read reactions"      ON message_reactions;
DROP POLICY IF EXISTS "Users can manage own reactions" ON message_reactions;
CREATE POLICY "Anyone can read reactions" ON message_reactions FOR SELECT USING (true);
CREATE POLICY "Users can manage own reactions" ON message_reactions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM accounts WHERE id = auth.uid() AND ctu_id = message_reactions.sender_id))
  WITH CHECK (EXISTS (SELECT 1 FROM accounts WHERE id = auth.uid() AND ctu_id = message_reactions.sender_id));


-- ── 13. MESSAGE_READS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_reads (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  reader_id  uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  read_at    timestamptz DEFAULT now(),
  UNIQUE (message_id, reader_id)
);
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert own reads" ON message_reads;
DROP POLICY IF EXISTS "Users can read all reads"   ON message_reads;
CREATE POLICY "Users can insert own reads" ON message_reads FOR INSERT WITH CHECK (auth.uid() = reader_id);
CREATE POLICY "Users can read all reads"   ON message_reads FOR SELECT USING (true);


-- ── 14. CAMPUS_EVENTS ────────────────────────────────────────────────
-- Created before announcement_events because announcement_events.generated_event_id references it
CREATE TABLE IF NOT EXISTS campus_events (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text        NOT NULL,
  description    text,
  event_date     date        NOT NULL,
  event_end_date date,
  event_time     text,
  location       text,
  category       text        DEFAULT 'general',
  poster_id      uuid        REFERENCES accounts(id) ON DELETE SET NULL,
  is_official    boolean     DEFAULT false,
  community_id   uuid        REFERENCES communities(id) ON DELETE CASCADE,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campus_events_community_date ON campus_events(community_id, event_date);
ALTER TABLE campus_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users see campus-wide or their circle events" ON campus_events;
DROP POLICY IF EXISTS "No direct inserts from frontend"              ON campus_events;
DROP POLICY IF EXISTS "No direct deletes from frontend"              ON campus_events;
CREATE POLICY "Users see campus-wide or their circle events"
  ON campus_events FOR SELECT
  USING (
    community_id IS NULL
    OR EXISTS (
      SELECT 1 FROM memberships
      WHERE memberships.community_id = campus_events.community_id
        AND memberships.user_id = auth.uid()
        AND memberships.status = 'active'
    )
  );
CREATE POLICY "No direct inserts from frontend" ON campus_events FOR INSERT WITH CHECK (false);
CREATE POLICY "No direct deletes from frontend" ON campus_events FOR DELETE USING (false);


-- ── 15. ANNOUNCEMENTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id           uuid        REFERENCES accounts(id) ON DELETE CASCADE,
  title               text        NOT NULL,
  content             text        NOT NULL,
  post_type           text        DEFAULT 'general',
  pinned              boolean     DEFAULT false,
  anonymous           boolean     DEFAULT false,
  community_id        uuid        REFERENCES communities(id) ON DELETE CASCADE,
  solution_comment_id uuid,
  media_url           text,
  cross_posted_from   uuid        REFERENCES announcements(id) ON DELETE SET NULL,
  visibility          text        DEFAULT 'public'
                                  CHECK (visibility IN ('public','members','connections')),
  created_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_announcements_social_polls ON announcements(community_id, post_type) WHERE post_type = 'poll';
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read announcements"     ON announcements;
DROP POLICY IF EXISTS "Users can create announcements"   ON announcements;
DROP POLICY IF EXISTS "OP or creator can mark solution"  ON announcements;
DROP POLICY IF EXISTS "Authors or admins delete posts"   ON announcements;
CREATE POLICY "Anyone can read announcements"   ON announcements FOR SELECT USING (true);
CREATE POLICY "Users can create announcements" ON announcements FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "OP or creator can mark solution" ON announcements FOR UPDATE TO authenticated
  USING (
    auth.uid() = author_id
    OR EXISTS (SELECT 1 FROM accounts WHERE id = auth.uid() AND user_type = 'Admin')
    OR EXISTS (SELECT 1 FROM communities WHERE communities.id = announcements.community_id AND communities.creator_id = auth.uid())
  )
  WITH CHECK (
    auth.uid() = author_id
    OR EXISTS (SELECT 1 FROM accounts WHERE id = auth.uid() AND user_type = 'Admin')
    OR EXISTS (SELECT 1 FROM communities WHERE communities.id = announcements.community_id AND communities.creator_id = auth.uid())
  );
CREATE POLICY "Authors or admins delete posts" ON announcements FOR DELETE TO authenticated
  USING (
    auth.uid() = author_id
    OR EXISTS (SELECT 1 FROM accounts WHERE id = auth.uid() AND user_type = 'Admin')
    OR EXISTS (SELECT 1 FROM communities WHERE communities.id = announcements.community_id AND communities.creator_id = auth.uid())
  );


-- ── 16. POLL_OPTIONS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS poll_options (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  option_text     text NOT NULL,
  display_order   int  DEFAULT 0
);
ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read poll options"     ON poll_options;
DROP POLICY IF EXISTS "Authors can manage poll options"  ON poll_options;
CREATE POLICY "Anyone can read poll options" ON poll_options FOR SELECT USING (true);
CREATE POLICY "Authors can manage poll options" ON poll_options FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM announcements a WHERE a.id = announcement_id AND a.author_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM announcements a WHERE a.id = announcement_id AND a.author_id = auth.uid()));


-- ── 17. POLL_VOTES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS poll_votes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid        NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  option_id       uuid        NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  voter_id        uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  voted_at        timestamptz DEFAULT now(),
  UNIQUE (announcement_id, voter_id)
);
ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read poll votes"   ON poll_votes;
DROP POLICY IF EXISTS "Users manage own poll votes" ON poll_votes;
CREATE POLICY "Anyone can read poll votes"   ON poll_votes FOR SELECT USING (true);
CREATE POLICY "Users manage own poll votes" ON poll_votes FOR ALL TO authenticated
  USING (auth.uid() = voter_id) WITH CHECK (auth.uid() = voter_id);


-- ── 18. ANNOUNCEMENT_EVENTS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcement_events (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id    uuid        NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  event_date         date        NOT NULL,
  event_time         time,
  location           text,
  is_closed          boolean     DEFAULT false,
  closed_at          timestamptz,
  closed_by          uuid        REFERENCES accounts(id),
  generated_event_id uuid        REFERENCES campus_events(id) ON DELETE SET NULL
);
ALTER TABLE announcement_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read announcement events"     ON announcement_events;
DROP POLICY IF EXISTS "Authors can insert announcement events"  ON announcement_events;
CREATE POLICY "Anyone can read announcement events"    ON announcement_events FOR SELECT USING (true);
CREATE POLICY "Authors can insert announcement events" ON announcement_events FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM announcements a WHERE a.id = announcement_id AND a.author_id = auth.uid()));


-- ── 19. POST_COMMENTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_comments (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid        REFERENCES announcements(id) ON DELETE CASCADE,
  author_id       uuid        REFERENCES accounts(id) ON DELETE CASCADE,
  content         text        NOT NULL,
  created_at      timestamptz DEFAULT now(),
  parent_id       uuid        REFERENCES post_comments(id) ON DELETE CASCADE,
  edited          boolean     DEFAULT false
);
ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read comments"      ON post_comments;
DROP POLICY IF EXISTS "Users can manage own comments" ON post_comments;
CREATE POLICY "Anyone can read comments"      ON post_comments FOR SELECT USING (true);
CREATE POLICY "Users can manage own comments" ON post_comments FOR ALL    USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);

-- Add FK from announcements.solution_comment_id -> post_comments.id
ALTER TABLE announcements
  DROP CONSTRAINT IF EXISTS announcements_solution_comment_id_fkey;
ALTER TABLE announcements
  ADD CONSTRAINT announcements_solution_comment_id_fkey
    FOREIGN KEY (solution_comment_id) REFERENCES post_comments(id) ON DELETE SET NULL;


-- ── 20. COMMENT_HEARTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comment_hearts (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid        NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (comment_id, user_id)
);
ALTER TABLE comment_hearts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read comment hearts"   ON comment_hearts;
DROP POLICY IF EXISTS "Users manage own comment hearts"  ON comment_hearts;
CREATE POLICY "Anyone can read comment hearts"  ON comment_hearts FOR SELECT USING (true);
CREATE POLICY "Users manage own comment hearts" ON comment_hearts FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ── 21. POST_REACTIONS ───────────────────────────────────────────────
-- Unified reactions for posts (general 'like' + showcase feedback tags)
CREATE TABLE IF NOT EXISTS post_reactions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid        NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  reaction_type   text        NOT NULL CHECK (reaction_type IN (
                                'like', 'effort', 'creative', 'technique', 'style', 'impact'
                              )),
  created_at      timestamptz DEFAULT now(),
  UNIQUE (announcement_id, user_id, reaction_type)
);
CREATE INDEX IF NOT EXISTS idx_post_reactions_announcement_id ON post_reactions(announcement_id);
CREATE INDEX IF NOT EXISTS idx_post_reactions_user_id         ON post_reactions(user_id);
ALTER TABLE post_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read post reactions"   ON post_reactions;
DROP POLICY IF EXISTS "Users manage own post reactions" ON post_reactions;
CREATE POLICY "Anyone can read post reactions"  ON post_reactions FOR SELECT USING (true);
CREATE POLICY "Users manage own post reactions" ON post_reactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ── 23. NOTIFICATIONS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        REFERENCES accounts(id) ON DELETE CASCADE,
  type         text        NOT NULL,
  message      text        NOT NULL,
  link_comm_id uuid        REFERENCES communities(id) ON DELETE SET NULL,
  is_read      boolean     DEFAULT false,
  category     text        CHECK (category IN ('Connections', 'Circles', 'Campus')),
  group_key    text,
  group_count  int         NOT NULL DEFAULT 1,
  created_at   timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own notifications"   ON notifications;
DROP POLICY IF EXISTS "Users update own notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated insert notifications" ON notifications;
CREATE POLICY "Users read own notifications"       ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications"     ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Authenticated insert notifications" ON notifications FOR INSERT TO authenticated WITH CHECK (true);


-- ── 24. NOTIFICATION_MUTES ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_mutes (
  user_id  uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('Connections', 'Circles', 'Campus')),
  PRIMARY KEY (user_id, category)
);
ALTER TABLE notification_mutes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own mutes" ON notification_mutes;
CREATE POLICY "Users manage own mutes" ON notification_mutes FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ── 25. APPLICATIONS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS applications (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid        NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  title        text        NOT NULL,
  description  text,
  type         text        DEFAULT 'external' CHECK (type IN ('external', 'internal')),
  is_open      boolean     DEFAULT true,
  post_to_feed boolean     DEFAULT false,
  created_by   uuid        REFERENCES accounts(id),
  created_at   timestamptz DEFAULT now(),
  deadline     timestamptz
);
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read applications"     ON applications;
DROP POLICY IF EXISTS "Leaders can manage applications"  ON applications;
CREATE POLICY "Anyone can read applications" ON applications FOR SELECT USING (true);
CREATE POLICY "Leaders can manage applications" ON applications FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM communities c WHERE c.id = community_id AND c.creator_id = auth.uid())
    OR EXISTS (SELECT 1 FROM memberships m WHERE m.community_id = applications.community_id AND m.user_id = auth.uid() AND m.rank_level >= 1 AND m.status IN ('active', 'approved'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM communities c WHERE c.id = community_id AND c.creator_id = auth.uid())
    OR EXISTS (SELECT 1 FROM memberships m WHERE m.community_id = applications.community_id AND m.user_id = auth.uid() AND m.rank_level >= 1 AND m.status IN ('active', 'approved'))
  );


-- ── 26. APPLICATION_QUESTIONS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS application_questions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid        NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  question       text        NOT NULL,
  type           text        DEFAULT 'text' CHECK (type IN ('text', 'choice', 'file')),
  order_index    int         DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_app_questions_application ON application_questions(application_id);
ALTER TABLE application_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read application_questions"     ON application_questions;
DROP POLICY IF EXISTS "Leaders can manage application_questions"  ON application_questions;
CREATE POLICY "Anyone can read application_questions" ON application_questions FOR SELECT USING (true);
CREATE POLICY "Leaders can manage application_questions" ON application_questions FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      JOIN communities c ON c.id = a.community_id
      WHERE a.id = application_id
        AND (c.creator_id = auth.uid() OR EXISTS (
          SELECT 1 FROM memberships m WHERE m.community_id = c.id AND m.user_id = auth.uid() AND m.rank_level >= 1 AND m.status IN ('active', 'approved')
        ))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM applications a
      JOIN communities c ON c.id = a.community_id
      WHERE a.id = application_id
        AND (c.creator_id = auth.uid() OR EXISTS (
          SELECT 1 FROM memberships m WHERE m.community_id = c.id AND m.user_id = auth.uid() AND m.rank_level >= 1 AND m.status IN ('active', 'approved')
        ))
    )
  );


-- ── 27. APPLICATION_QUESTION_OPTIONS ─────────────────────────────────
-- 1NF table (replaces jsonb options on application_questions)
CREATE TABLE IF NOT EXISTS application_question_options (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   uuid NOT NULL REFERENCES application_questions(id) ON DELETE CASCADE,
  option_text   text NOT NULL,
  display_order int  DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_app_question_options_question ON application_question_options(question_id);
ALTER TABLE application_question_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read application_question_options"    ON application_question_options;
DROP POLICY IF EXISTS "Leaders can manage application_question_options" ON application_question_options;
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


-- ── 28. APPLICATION_SUBMISSIONS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS application_submissions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id uuid        NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  applicant_id   uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status         text        DEFAULT 'pending' CHECK (status IN ('pending', 'phase2', 'accepted', 'rejected')),
  feedback       text,
  phase2_details text,
  phase2_result  text        CHECK (phase2_result IS NULL OR phase2_result IN ('accepted', 'rejected')),
  submitted_at   timestamptz DEFAULT now(),
  reviewed_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_app_submissions_application ON application_submissions(application_id);
CREATE INDEX IF NOT EXISTS idx_app_submissions_applicant   ON application_submissions(applicant_id);
ALTER TABLE application_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read own or circle application submissions" ON application_submissions;
DROP POLICY IF EXISTS "Applicants submit applications"           ON application_submissions;
DROP POLICY IF EXISTS "Leaders review application submissions"     ON application_submissions;
CREATE POLICY "Read own or circle application submissions" ON application_submissions FOR SELECT TO authenticated
  USING (
    auth.uid() = applicant_id
    OR EXISTS (
      SELECT 1 FROM applications a
      JOIN communities c ON c.id = a.community_id
      WHERE a.id = application_id
        AND (c.creator_id = auth.uid() OR EXISTS (
          SELECT 1 FROM memberships m WHERE m.community_id = c.id AND m.user_id = auth.uid() AND m.rank_level >= 1 AND m.status IN ('active', 'approved')
        ))
    )
  );
CREATE POLICY "Applicants submit applications" ON application_submissions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = applicant_id);
CREATE POLICY "Leaders review application submissions" ON application_submissions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM applications a
      JOIN communities c ON c.id = a.community_id
      WHERE a.id = application_id
        AND (c.creator_id = auth.uid() OR EXISTS (
          SELECT 1 FROM memberships m WHERE m.community_id = c.id AND m.user_id = auth.uid() AND m.rank_level >= 1 AND m.status IN ('active', 'approved')
        ))
    )
  );


-- ── 29. APPLICATION_ANSWERS ──────────────────────────────────────────
-- 1NF table (replaces jsonb answers on application_submissions)
CREATE TABLE IF NOT EXISTS application_answers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES application_submissions(id) ON DELETE CASCADE,
  question_id   uuid NOT NULL REFERENCES application_questions(id) ON DELETE CASCADE,
  answer_text   text,
  UNIQUE (submission_id, question_id)
);
CREATE INDEX IF NOT EXISTS idx_app_answers_submission ON application_answers(submission_id);
ALTER TABLE application_answers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read own or circle application answers" ON application_answers;
DROP POLICY IF EXISTS "Applicants insert own answers"          ON application_answers;
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


-- ── 30. CONNECTIONS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS connections (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  connected_user_id uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  status            text        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT connections_no_self     CHECK (user_id <> connected_user_id),
  CONSTRAINT connections_unique_pair UNIQUE (user_id, connected_user_id)
);
CREATE INDEX IF NOT EXISTS idx_connections_user_id           ON connections(user_id);
CREATE INDEX IF NOT EXISTS idx_connections_connected_user_id ON connections(connected_user_id);
CREATE INDEX IF NOT EXISTS idx_connections_status            ON connections(status);
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own connections"   ON connections;
DROP POLICY IF EXISTS "Users insert own requests"    ON connections;
DROP POLICY IF EXISTS "Users update own connections" ON connections;
DROP POLICY IF EXISTS "Users delete own connections" ON connections;
CREATE POLICY "Users read own connections"   ON connections FOR SELECT USING (auth.uid() = user_id OR auth.uid() = connected_user_id);
CREATE POLICY "Users insert own requests"    ON connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own connections" ON connections FOR UPDATE USING (auth.uid() = connected_user_id OR auth.uid() = user_id);
CREATE POLICY "Users delete own connections" ON connections FOR DELETE USING (auth.uid() = user_id OR auth.uid() = connected_user_id);


-- ── 31. BLOCKS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blocks (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  blocked_id uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocks_no_self     CHECK (blocker_id <> blocked_id),
  CONSTRAINT blocks_unique_pair UNIQUE (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker_id ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked_id ON blocks(blocked_id);
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own blocks"   ON blocks;
DROP POLICY IF EXISTS "Users insert own blocks" ON blocks;
DROP POLICY IF EXISTS "Users delete own blocks" ON blocks;
CREATE POLICY "Users read own blocks"   ON blocks FOR SELECT USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);
CREATE POLICY "Users insert own blocks" ON blocks FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users delete own blocks" ON blocks FOR DELETE USING (auth.uid() = blocker_id);


-- ── 32. REPORTS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reports (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id      uuid        REFERENCES accounts(id) ON DELETE CASCADE,
  reported_user_id uuid        REFERENCES accounts(id) ON DELETE CASCADE,
  content_type     text        CHECK (content_type IN ('message','announcement','user','circle','profile_photo','circle_photo')),
  content_id       text,
  content_preview  text,
  reason           text        NOT NULL,
  status           text        DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  admin_note       text,
  reviewed_at      timestamptz,
  reviewed_by      uuid        REFERENCES accounts(id),
  created_at       timestamptz DEFAULT now()
);
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can submit reports" ON reports;
DROP POLICY IF EXISTS "Users read own reports"   ON reports;
CREATE POLICY "Users can submit reports" ON reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users read own reports"   ON reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id);


-- ── 33. USER_WARNINGS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_warnings (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        REFERENCES accounts(id) ON DELETE CASCADE,
  admin_id        uuid        REFERENCES accounts(id),
  type            text        DEFAULT 'warning' CHECK (type IN ('warning', 'ban')),
  reason          text        NOT NULL,
  severity        text        DEFAULT 'minor' CHECK (severity IN ('minor','moderate','severe','critical')),
  points_deducted int         DEFAULT 0,
  community_id    uuid        REFERENCES communities(id) ON DELETE SET NULL,
  status          text        DEFAULT 'active' CHECK (status IN ('active','appealed','overturned','expired')),
  reviewed_by     uuid        REFERENCES accounts(id),
  reviewed_at     timestamptz,
  created_at      timestamptz DEFAULT now()
);
ALTER TABLE user_warnings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own warnings" ON user_warnings;
CREATE POLICY "Users read own warnings" ON user_warnings FOR SELECT TO authenticated USING (auth.uid() = user_id);


-- ── 34. WARNING_APPEALS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS warning_appeals (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  warning_id     uuid        NOT NULL REFERENCES user_warnings(id) ON DELETE CASCADE,
  user_id        uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  appeal_reason  text        NOT NULL,
  evidence       text,
  status         text        DEFAULT 'pending' CHECK (status IN ('pending','approved','denied')),
  admin_decision text,
  reviewed_by    uuid        REFERENCES accounts(id),
  reviewed_at    timestamptz,
  created_at     timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appeals_warning ON warning_appeals(warning_id);
CREATE INDEX IF NOT EXISTS idx_appeals_status  ON warning_appeals(status);
CREATE INDEX IF NOT EXISTS idx_appeals_user    ON warning_appeals(user_id);
ALTER TABLE warning_appeals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own appeals" ON warning_appeals;
DROP POLICY IF EXISTS "Users can create appeals"   ON warning_appeals;
CREATE POLICY "Users can read own appeals" ON warning_appeals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create appeals"   ON warning_appeals FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ── 35. USER_FLAGS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_flags (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  flagged_user_id uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  flagger_id      uuid        NOT NULL REFERENCES accounts(id),
  community_id    uuid        REFERENCES communities(id) ON DELETE CASCADE,
  reason          text        NOT NULL,
  severity        text        DEFAULT 'moderate' CHECK (severity IN ('minor','moderate','severe','critical')),
  status          text        DEFAULT 'pending'  CHECK (status IN ('pending','reviewed','dismissed','warning_issued')),
  admin_notes     text,
  reviewed_by     uuid        REFERENCES accounts(id),
  reviewed_at     timestamptz,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_flags_user      ON user_flags(flagged_user_id);
CREATE INDEX IF NOT EXISTS idx_flags_status    ON user_flags(status);
CREATE INDEX IF NOT EXISTS idx_flags_community ON user_flags(community_id);
ALTER TABLE user_flags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own flags"   ON user_flags;
DROP POLICY IF EXISTS "Leaders can create flags"   ON user_flags;
CREATE POLICY "Users can read own flags" ON user_flags FOR SELECT USING (auth.uid() = flagged_user_id);
CREATE POLICY "Leaders can create flags" ON user_flags FOR INSERT WITH CHECK (auth.uid() = flagger_id);


-- ── SUPPORT_TICKETS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS support_tickets (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES accounts(id) ON DELETE CASCADE,
  category   text        CHECK (category IN (
               'Bug Report','Account Issue','General Question','Circle Problem',
               'Other','Ban Appeal','Suspension Appeal','Deletion Appeal'
             )),
  message    text        NOT NULL,
  status     text        DEFAULT 'open' CHECK (status IN ('open','resolved','closed')),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status  ON support_tickets(status);
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can submit own tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can view own tickets"   ON support_tickets;
CREATE POLICY "Users can submit own tickets" ON support_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own tickets"   ON support_tickets FOR SELECT TO authenticated USING (auth.uid() = user_id);


-- ── 39. ACCOUNT_DELETION_WARNINGS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS account_deletion_warnings (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  reason      text        NOT NULL,
  flagged_by  uuid        REFERENCES accounts(id) ON DELETE SET NULL,
  flagged_at  timestamptz NOT NULL DEFAULT now(),
  deadline    timestamptz NOT NULL,
  status      text        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_acct_del_warnings_account ON account_deletion_warnings(account_id);
ALTER TABLE account_deletion_warnings ENABLE ROW LEVEL SECURITY;


-- ── 40. COMMUNITY_DELETION_WARNINGS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS community_deletion_warnings (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid        NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  reason       text        NOT NULL,
  flagged_by   uuid        REFERENCES accounts(id) ON DELETE SET NULL,
  flagged_at   timestamptz NOT NULL DEFAULT now(),
  deadline     timestamptz NOT NULL,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'confirmed', 'dismissed')),
  resolved_at  timestamptz
);
CREATE INDEX IF NOT EXISTS idx_comm_del_warnings_community ON community_deletion_warnings(community_id);
ALTER TABLE community_deletion_warnings ENABLE ROW LEVEL SECURITY;


-- ── 42. POINT_TRANSACTIONS ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS point_transactions (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid          NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  amount           decimal(4,1)  NOT NULL,
  transaction_type text          NOT NULL CHECK (transaction_type IN (
                     'warning','appreciation','daily_recovery',
                     'appeal_approved','admin_bonus','harassment_penalty',
                     'welcome_bonus','shop_purchase'
                   )),
  from_user_id     uuid          REFERENCES accounts(id),
  community_id     uuid          REFERENCES communities(id),
  reason           text,
  reference_id     uuid,
  created_at       timestamptz   DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_point_transactions_user ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_date ON point_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type ON point_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_point_transactions_appreciation_cooldown
  ON point_transactions(from_user_id, user_id, created_at)
  WHERE transaction_type = 'appreciation';
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own transactions" ON point_transactions;
CREATE POLICY "Users can read own transactions" ON point_transactions FOR SELECT USING (auth.uid() = user_id);


-- ── 44. SHOP_ITEMS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shop_items (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  description text,
  type        text        NOT NULL CHECK (type IN (
                'theme','badge','background','name_color',
                'music','avatar_border','companion'
              )),
  price       int         NOT NULL DEFAULT 0,
  preview_url text,
  css_data    jsonb,
  is_active   boolean     DEFAULT true,
  created_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shop_items_type   ON shop_items(type);
CREATE INDEX IF NOT EXISTS idx_shop_items_active ON shop_items(is_active);
ALTER TABLE shop_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read active shop items" ON shop_items;
CREATE POLICY "Anyone can read active shop items" ON shop_items FOR SELECT USING (is_active = true);


-- ── 45. USER_PURCHASES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_purchases (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  item_id      uuid        NOT NULL REFERENCES shop_items(id) ON DELETE CASCADE,
  purchased_at timestamptz DEFAULT now(),
  UNIQUE (user_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_user_purchases_user ON user_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_user_purchases_item ON user_purchases(item_id);
ALTER TABLE user_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own purchases"   ON user_purchases;
DROP POLICY IF EXISTS "Users can insert own purchases" ON user_purchases;
CREATE POLICY "Users can read own purchases"   ON user_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own purchases" ON user_purchases FOR INSERT WITH CHECK (auth.uid() = user_id);


-- ── 46. USER_PROFILE_SETTINGS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_profile_settings (
  user_id              uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  active_theme         uuid REFERENCES shop_items(id) ON DELETE SET NULL,
  active_badge         uuid REFERENCES shop_items(id) ON DELETE SET NULL,
  active_background    uuid REFERENCES shop_items(id) ON DELETE SET NULL,
  active_name_color    uuid REFERENCES shop_items(id) ON DELETE SET NULL,
  active_avatar_border uuid REFERENCES shop_items(id) ON DELETE SET NULL,
  active_companion     uuid REFERENCES shop_items(id) ON DELETE SET NULL,
  active_music         uuid REFERENCES shop_items(id) ON DELETE SET NULL,
  updated_at           timestamptz DEFAULT now()
);
ALTER TABLE user_profile_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own settings"   ON user_profile_settings;
DROP POLICY IF EXISTS "Users can update own settings" ON user_profile_settings;
CREATE POLICY "Users can read own settings"   ON user_profile_settings FOR SELECT USING (true);
CREATE POLICY "Users can update own settings" ON user_profile_settings FOR ALL    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ── 47. PROFILE_PHOTOS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_photos (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  photo_url  text        NOT NULL,
  slot       int         NOT NULL CHECK (slot IN (1, 2)),
  is_public  boolean     DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, slot)
);
ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view public profile photos" ON profile_photos;
DROP POLICY IF EXISTS "Users can manage own photos"           ON profile_photos;
CREATE POLICY "Anyone can view public profile photos" ON profile_photos FOR SELECT USING (true);
CREATE POLICY "Users can manage own photos"           ON profile_photos FOR ALL    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ── 48. PROFILE_PHOTO_REACTIONS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS profile_photo_reactions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id   uuid        NOT NULL REFERENCES profile_photos(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (photo_id, user_id)
);
ALTER TABLE profile_photo_reactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view photo reactions"   ON profile_photo_reactions;
DROP POLICY IF EXISTS "Users manage own photo reactions"  ON profile_photo_reactions;
CREATE POLICY "Anyone can view photo reactions"  ON profile_photo_reactions FOR SELECT USING (true);
CREATE POLICY "Users manage own photo reactions" ON profile_photo_reactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ── 49. CIRCLE_REVIEWS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS circle_reviews (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid        NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  reviewer_id  uuid        NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  rating       int         NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      text,
  created_at   timestamptz DEFAULT now(),
  UNIQUE (community_id, reviewer_id)
);
ALTER TABLE circle_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read circle reviews"     ON circle_reviews;
DROP POLICY IF EXISTS "Users manage own circle reviews"    ON circle_reviews;
CREATE POLICY "Anyone can read circle reviews"  ON circle_reviews FOR SELECT USING (true);
CREATE POLICY "Users manage own circle reviews" ON circle_reviews FOR ALL TO authenticated
  USING (auth.uid() = reviewer_id) WITH CHECK (auth.uid() = reviewer_id);


-- ── 50. CIRCLE_CALLS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS circle_calls (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id uuid        NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  room_name    text,
  started_by   uuid        REFERENCES accounts(id),
  started_at   timestamptz DEFAULT now(),
  ended_at     timestamptz,
  status       text        DEFAULT 'active' CHECK (status IN ('active','ended'))
);
ALTER TABLE circle_calls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users read circle calls" ON circle_calls;
CREATE POLICY "Authenticated users read circle calls" ON circle_calls FOR SELECT TO authenticated USING (true);


-- ── 51. TASK_ITEMS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_items (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id   uuid        NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  title        text        NOT NULL,
  description  text,
  assigned_to  uuid        REFERENCES accounts(id) ON DELETE SET NULL,
  status       text        DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  priority     text        DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  due_date     timestamptz,
  created_by   uuid        REFERENCES accounts(id),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_task_items_channel  ON task_items(channel_id);
CREATE INDEX IF NOT EXISTS idx_task_items_assigned ON task_items(assigned_to);
CREATE INDEX IF NOT EXISTS idx_task_items_status   ON task_items(status);
CREATE INDEX IF NOT EXISTS idx_task_items_due_date ON task_items(due_date);
ALTER TABLE task_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Circle members can view tasks"        ON task_items;
DROP POLICY IF EXISTS "Circle members can create tasks"      ON task_items;
DROP POLICY IF EXISTS "Circle members can update tasks"      ON task_items;
DROP POLICY IF EXISTS "Task creator or moderators can delete" ON task_items;
CREATE POLICY "Circle members can view tasks" ON task_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN channels c ON c.community_id = m.community_id
      WHERE c.id = task_items.channel_id AND m.user_id = auth.uid()
    )
  );
CREATE POLICY "Circle members can create tasks" ON task_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN channels c ON c.community_id = m.community_id
      WHERE c.id = channel_id AND m.user_id = auth.uid()
    )
  );
CREATE POLICY "Circle members can update tasks" ON task_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN channels c ON c.community_id = m.community_id
      WHERE c.id = channel_id AND m.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN channels c ON c.community_id = m.community_id
      WHERE c.id = channel_id AND m.user_id = auth.uid()
    )
  );
CREATE POLICY "Task creator or moderators can delete" ON task_items FOR DELETE TO authenticated
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM memberships m
      JOIN channels c ON c.community_id = m.community_id
      WHERE c.id = task_items.channel_id
        AND m.user_id = auth.uid()
        AND m.rank_level >= 1
    )
  );


-- ── SERVICE ROLE FULL ACCESS ON ALL PUBLIC TABLES ────────────────────
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS "Service role full access" ON %I;
      CREATE POLICY "Service role full access" ON %I
        TO service_role USING (true) WITH CHECK (true);
    ', t, t);
  END LOOP;
END $$;


-- ── STORAGE BUCKETS & POLICIES ───────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 'avatars', true, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-media', 'chat-media', true, 52428800,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime',
    'audio/webm', 'audio/mpeg', 'audio/ogg', 'audio/wav'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view avatars"    ON storage.objects;
DROP POLICY IF EXISTS "Allow avatar uploads"       ON storage.objects;
DROP POLICY IF EXISTS "Allow avatar updates"       ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Members can view chat media"  ON storage.objects;
DROP POLICY IF EXISTS "Allow chat media uploads"     ON storage.objects;
DROP POLICY IF EXISTS "Allow chat media updates"     ON storage.objects;

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');
CREATE POLICY "Allow avatar uploads"
  ON storage.objects FOR INSERT TO public
  WITH CHECK (bucket_id = 'avatars' AND (auth.role() = 'authenticated' OR auth.role() = 'service_role'));
CREATE POLICY "Allow avatar updates"
  ON storage.objects FOR UPDATE TO public
  USING (bucket_id = 'avatars')
  WITH CHECK (bucket_id = 'avatars' AND (auth.role() = 'authenticated' OR auth.role() = 'service_role'));
CREATE POLICY "Users can delete own avatars"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Members can view chat media"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'chat-media');
CREATE POLICY "Allow chat media uploads"
  ON storage.objects FOR INSERT TO public
  WITH CHECK (bucket_id = 'chat-media' AND (auth.role() = 'authenticated' OR auth.role() = 'service_role'));
CREATE POLICY "Allow chat media updates"
  ON storage.objects FOR UPDATE TO public
  USING (bucket_id = 'chat-media')
  WITH CHECK (bucket_id = 'chat-media' AND (auth.role() = 'authenticated' OR auth.role() = 'service_role'));


-- ── FUNCTIONS & TRIGGERS ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_trust_points(target_user_id uuid)
RETURNS decimal(4,1) AS $$
DECLARE
  total_points decimal(4,1);
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO total_points
  FROM point_transactions WHERE user_id = target_user_id;
  IF total_points < 0 THEN total_points := 0;
  ELSIF total_points > 20 THEN total_points := 20;
  END IF;
  RETURN total_points;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION can_give_appreciation(p_giver_id uuid, p_receiver_id uuid)
RETURNS boolean AS $$
DECLARE last_given timestamptz;
BEGIN
  IF p_giver_id = p_receiver_id THEN RETURN false; END IF;
  SELECT MAX(created_at) INTO last_given
  FROM point_transactions
  WHERE transaction_type = 'appreciation'
    AND from_user_id = p_giver_id
    AND user_id = p_receiver_id;
  IF last_given IS NULL THEN RETURN true; END IF;
  RETURN NOW() - last_given >= INTERVAL '12 hours';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_auto_suspension(target_user_id uuid)
RETURNS void AS $$
DECLARE current_points decimal(4,1);
BEGIN
  current_points := get_user_trust_points(target_user_id);
  IF current_points <= 0 THEN
    UPDATE account_status SET is_banned = true, suspended_until = NULL
    WHERE id = target_user_id AND NOT is_banned;
    INSERT INTO notifications (user_id, type, message)
    VALUES (target_user_id, 'join_denied', 'Your account has been permanently banned due to trust points reaching 0.');
    RETURN;
  END IF;
  IF current_points >= 1 AND current_points <= 3 THEN
    UPDATE account_status SET is_banned = false, suspended_until = NOW() + INTERVAL '7 days'
    WHERE id = target_user_id AND (suspended_until IS NULL OR suspended_until < NOW() + INTERVAL '7 days');
    RETURN;
  END IF;
  IF current_points >= 7 THEN
    UPDATE account_status SET is_banned = false, suspended_until = NULL
    WHERE id = target_user_id AND (is_banned = true OR suspended_until IS NOT NULL);
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION trigger_check_suspension()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM check_auto_suspension(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS auto_suspension_trigger ON point_transactions;
CREATE TRIGGER auto_suspension_trigger
  AFTER INSERT ON point_transactions
  FOR EACH ROW EXECUTE FUNCTION trigger_check_suspension();


-- ── SEED DATA (Shop Items) ───────────────────────────────────────────
INSERT INTO shop_items (name, description, type, price, css_data) VALUES
  ('Cyber Blue', 'Classic neon blue theme', 'theme', 5, '{"primary": "#00f0ff", "secondary": "#0080ff", "gradient": "linear-gradient(135deg, #00f0ff, #0080ff)"}'),
  ('Sunset Orange', 'Warm sunset gradient', 'theme', 5, '{"primary": "#ff6b35", "secondary": "#f7931e", "gradient": "linear-gradient(135deg, #ff6b35, #f7931e)"}'),
  ('Neon Purple', 'Electric purple vibes', 'theme', 8, '{"primary": "#a855f7", "secondary": "#ec4899", "gradient": "linear-gradient(135deg, #a855f7, #ec4899)"}'),
  ('Matrix Green', 'Classic hacker aesthetic', 'theme', 8, '{"primary": "#00ff41", "secondary": "#00d930", "gradient": "linear-gradient(135deg, #00ff41, #00d930)"}')
ON CONFLICT DO NOTHING;

INSERT INTO shop_items (name, description, type, price, preview_url) VALUES
  ('Star Badge', 'Golden star next to your name', 'badge', 3, '⭐'),
  ('Fire Badge', 'You''re on fire!', 'badge', 3, '🔥'),
  ('Crown Badge', 'Royal status', 'badge', 5, '👑'),
  ('Lightning Badge', 'Electric presence', 'badge', 4, '⚡'),
  ('Heart Badge', 'Spread the love', 'badge', 2, '💖')
ON CONFLICT DO NOTHING;

INSERT INTO shop_items (name, description, type, price, css_data) VALUES
  ('Gold Name', 'Shiny gold username', 'name_color', 3, '{"color": "#ffd700"}'),
  ('Rainbow Name', 'Rainbow gradient username', 'name_color', 5, '{"gradient": "linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3)"}'),
  ('Neon Pink', 'Hot pink username', 'name_color', 3, '{"color": "#ff10f0"}'),
  ('Ice Blue', 'Cool blue username', 'name_color', 3, '{"color": "#00d4ff"}')
ON CONFLICT DO NOTHING;

INSERT INTO shop_items (name, description, type, price, css_data) VALUES
  ('Dots Pattern', 'Subtle dot pattern', 'background', 4, '{"pattern": "radial-gradient(circle, rgba(0,240,255,0.1) 1px, transparent 1px)", "size": "20px 20px"}'),
  ('Grid Pattern', 'Tech grid background', 'background', 4, '{"pattern": "linear-gradient(rgba(0,240,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.1) 1px, transparent 1px)", "size": "30px 30px"}'),
  ('Waves', 'Flowing wave pattern', 'background', 6, '{"image": "url(\"data:image/svg+xml,...\")", "backgroundSize": "100px 40px", "backgroundRepeat": "repeat"}'),
  ('Stars', 'Starry night background', 'background', 5, '{"pattern": "radial-gradient(2px 2px at 20px 30px, white, transparent), radial-gradient(2px 2px at 60px 70px, white, transparent)"}'),
  ('Straw Hat Pirates', 'One Piece Straw Hat Pirates dark wallpaper background.', 'background', 15, '{"backgroundImage": "url(https://wallpapers-clan.com/wp-content/uploads/2020/08/one-piece-straw-hat-pirates-dark-wallpaper-scaled.jpg)", "backgroundSize": "cover", "backgroundPosition": "center"}')
ON CONFLICT DO NOTHING;

INSERT INTO shop_items (name, description, type, price, preview_url, css_data) VALUES
  ('Gold Ring', 'Classic gold border', 'avatar_border', 3, '🥇', '{"border": "3px solid #ffd700", "boxShadow": "0 0 10px rgba(255,215,0,0.5)"}'),
  ('Neon Glow', 'Glowing cyan border', 'avatar_border', 4, '💫', '{"border": "2px solid #00f0ff", "boxShadow": "0 0 15px rgba(0,240,255,0.8)"}'),
  ('Fire Ring', 'Fiery red glow', 'avatar_border', 5, '🔥', '{"border": "3px solid #ff4500", "boxShadow": "0 0 20px rgba(255,69,0,0.8)"}'),
  ('Rainbow Ring', 'Rainbow gradient border', 'avatar_border', 6, '🌈', '{"border": "4px solid transparent", "borderImage": "linear-gradient(45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #8b00ff) 1", "boxShadow": "0 0 12px rgba(255,255,255,0.5)"}'),
  ('Ice Frame', 'Frozen blue border', 'avatar_border', 4, '❄️', '{"border": "3px solid #00d4ff", "boxShadow": "0 0 15px rgba(0,212,255,0.6)"}'),
  ('Purple Aura', 'Mystical purple glow', 'avatar_border', 4, '💜', '{"border": "3px solid #9400d3", "boxShadow": "0 0 18px rgba(148,0,211,0.7)"}'),
  ('Emerald Edge', 'Green gem border', 'avatar_border', 5, '💚', '{"border": "3px solid #00ff88", "boxShadow": "0 0 15px rgba(0,255,136,0.6)"}'),
  ('Diamond Frame', 'Sparkling white border', 'avatar_border', 7, '💎', '{"border": "3px solid #ffffff", "boxShadow": "0 0 20px rgba(255,255,255,0.9), inset 0 0 10px rgba(255,255,255,0.3)"}')
ON CONFLICT DO NOTHING;

INSERT INTO shop_items (name, description, type, price, preview_url, css_data, is_active)
VALUES (
  'Naruto Chibi', 'Chibi Naruto companion sticker for your profile.', 'companion', 10,
  'https://banner2.cleanpng.com/cb3/qbd/tgr/a4lu9p9ci.webp',
  '{"url": "https://banner2.cleanpng.com/cb3/qbd/tgr/a4lu9p9ci.webp", "size": "64px"}',
  true
)
ON CONFLICT DO NOTHING;


-- ============================================================
-- TABLE COUNT SUMMARY (46 normalized tables)
-- ============================================================
-- 1.  accounts
-- 2.  account_status
-- 3.  account_details
-- 4.  user_interests
-- 5.  communities
-- 6.  community_interests
-- 7.  memberships
-- 8.  channels
-- 9.  circle_requests
-- 10. circle_request_invitees
-- 11. messages
-- 12. message_reactions
-- 13. message_reads
-- 14. campus_events
-- 15. announcements
-- 16. poll_options
-- 17. poll_votes
-- 18. announcement_events
-- 19. post_comments
-- 20. comment_hearts
-- 21. post_reactions
-- 22. notifications
-- 23. notification_mutes
-- 24. applications
-- 25. application_questions
-- 26. application_question_options
-- 27. application_submissions
-- 28. application_answers
-- 29. connections
-- 30. blocks
-- 31. reports
-- 32. user_warnings
-- 33. warning_appeals
-- 34. user_flags
-- 35. support_tickets
-- 36. account_deletion_warnings
-- 37. community_deletion_warnings
-- 38. point_transactions
-- 39. shop_items
-- 40. user_purchases
-- 41. user_profile_settings
-- 42. profile_photos
-- 43. profile_photo_reactions
-- 44. circle_reviews
-- 45. circle_calls
-- 46. task_items
-- ============================================================
