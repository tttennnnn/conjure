-- Conjure: Row-Level Security policies
-- Run once in the Supabase Dashboard SQL editor after creating a new project.
-- Note: DROP existing policies before re-running if policies already exist,
-- or run each statement individually.
--
-- IMPORTANT: keep this file in sync with prisma/schema.prisma.
-- Any new table added to the schema needs a corresponding ENABLE ROW LEVEL SECURITY
-- and CREATE POLICY block here, or Supabase will flag it as publicly accessible.

-- Enable RLS on all tables
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE credential_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

-- sessions: users can only access their own sessions
CREATE POLICY "Users can manage own sessions"
  ON sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- messages: access through parent session ownership
-- (messages has no user_id column; ownership is via the parent session)
CREATE POLICY "Users can manage messages in own sessions"
  ON messages FOR ALL
  USING (session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid()))
  WITH CHECK (session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid()));

-- credential_profiles: users can only access their own cloud credentials
CREATE POLICY "Users can manage own credential profiles"
  ON credential_profiles FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- user_api_keys: users can only access their own API keys
CREATE POLICY "Users can manage own API keys"
  ON user_api_keys FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
