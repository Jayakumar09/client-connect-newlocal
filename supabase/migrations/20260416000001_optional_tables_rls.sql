-- ============================================================
-- Migration: RLS Policies for Optional Tables
-- Run this in Supabase SQL Editor
-- ============================================================
-- This ensures:
-- 1. notification_preferences RLS - clients can only access their own
-- 2. notifications RLS - clients can only access their own
-- 3. profile_interests RLS - clients can only access their own
-- 4. profile_shortlists RLS - clients can only access their own
-- 5. profile_views RLS - clients can only access their own
-- 6. blocked_users RLS - clients can only access their own
-- 7. push_subscriptions RLS - clients can only access their own
-- ============================================================

-- ============================================================
-- 1. NOTIFICATION_PREFERENCES TABLE POLICIES
-- ============================================================

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access" ON notification_preferences;
DROP POLICY IF EXISTS "Users can view own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can insert own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can update own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can delete own notification preferences" ON notification_preferences;
DROP POLICY IF EXISTS "Users can manage own notification preferences" ON notification_preferences;

-- Clients can view their own notification preferences
CREATE POLICY "Users view own notification preferences"
ON notification_preferences FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Clients can insert their own notification preferences
CREATE POLICY "Users insert own notification preferences"
ON notification_preferences FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Clients can update their own notification preferences
CREATE POLICY "Users update own notification preferences"
ON notification_preferences FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Clients can delete their own notification preferences
CREATE POLICY "Users delete own notification preferences"
ON notification_preferences FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Service role for admin
CREATE POLICY "Service role manage notification_preferences"
ON notification_preferences FOR ALL
TO service_role
USING (true);

-- ============================================================
-- 2. NOTIFICATIONS TABLE POLICIES
-- ============================================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access" ON notifications;
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can manage own notifications" ON notifications;

-- Clients can view their own notifications
CREATE POLICY "Users view own notifications"
ON notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Clients can insert their own notifications
CREATE POLICY "Users insert own notifications"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Clients can update their own notifications
CREATE POLICY "Users update own notifications"
ON notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Clients can delete their own notifications
CREATE POLICY "Users delete own notifications"
ON notifications FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Service role for admin
CREATE POLICY "Service role manage notifications"
ON notifications FOR ALL
TO service_role
USING (true);

-- ============================================================
-- 3. PROFILE_INTERESTS TABLE POLICIES
-- ============================================================

ALTER TABLE profile_interests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access" ON profile_interests;
DROP POLICY IF EXISTS "Users can view own interests" ON profile_interests;
DROP POLICY IF EXISTS "Users can insert own interests" ON profile_interests;
DROP POLICY IF EXISTS "Users can update own interests" ON profile_interests;
DROP POLICY IF EXISTS "Users can delete own interests" ON profile_interests;
DROP POLICY IF EXISTS "Users can manage own interests" ON profile_interests;

-- Clients can view their own interests
CREATE POLICY "Users view own profile interests"
ON profile_interests FOR SELECT
TO authenticated
USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Clients can insert their own interests
CREATE POLICY "Users insert own profile interests"
ON profile_interests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = sender_id);

-- Clients can update their own interests
CREATE POLICY "Users update own profile interests"
ON profile_interests FOR UPDATE
TO authenticated
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);

-- Clients can delete their own interests
CREATE POLICY "Users delete own profile interests"
ON profile_interests FOR DELETE
TO authenticated
USING (auth.uid() = sender_id);

-- Service role for admin
CREATE POLICY "Service role manage profile_interests"
ON profile_interests FOR ALL
TO service_role
USING (true);

-- ============================================================
-- 4. PROFILE_SHORTLISTS TABLE POLICIES
-- ============================================================

ALTER TABLE profile_shortlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access" ON profile_shortlists;
DROP POLICY IF EXISTS "Users can view own shortlists" ON profile_shortlists;
DROP POLICY IF EXISTS "Users can insert own shortlists" ON profile_shortlists;
DROP POLICY IF EXISTS "Users can delete own shortlists" ON profile_shortlists;
DROP POLICY IF EXISTS "Users can manage own shortlists" ON profile_shortlists;

-- Clients can view their own shortlists
CREATE POLICY "Users view own profile shortlists"
ON profile_shortlists FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR auth.uid() = shortlisted_user_id);

-- Clients can insert their own shortlists
CREATE POLICY "Users insert own profile shortlists"
ON profile_shortlists FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Clients can delete their own shortlists
CREATE POLICY "Users delete own profile shortlists"
ON profile_shortlists FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Service role for admin
CREATE POLICY "Service role manage profile_shortlists"
ON profile_shortlists FOR ALL
TO service_role
USING (true);

-- ============================================================
-- 5. PROFILE_VIEWS TABLE POLICIES
-- ============================================================

ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access" ON profile_views;
DROP POLICY IF EXISTS "Users can view own views" ON profile_views;
DROP POLICY IF EXISTS "Users can insert own views" ON profile_views;
DROP POLICY IF EXISTS "Users can manage own views" ON profile_views;

-- Clients can view their own profile views
CREATE POLICY "Users view own profile views"
ON profile_views FOR SELECT
TO authenticated
USING (auth.uid() = viewer_id OR auth.uid() = viewed_profile_id);

-- Clients can insert their own profile views
CREATE POLICY "Users insert own profile views"
ON profile_views FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = viewer_id);

-- Service role for admin
CREATE POLICY "Service role manage profile_views"
ON profile_views FOR ALL
TO service_role
USING (true);

-- ============================================================
-- 6. BLOCKED_USERS TABLE POLICIES
-- ============================================================

ALTER TABLE blocked_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access" ON blocked_users;
DROP POLICY IF EXISTS "Users can view own blocked users" ON blocked_users;
DROP POLICY IF EXISTS "Users can insert own blocked users" ON blocked_users;
DROP POLICY IF EXISTS "Users can delete own blocked users" ON blocked_users;
DROP POLICY IF EXISTS "Users can manage own blocked users" ON blocked_users;

-- Clients can view their own blocked users
CREATE POLICY "Users view own blocked users"
ON blocked_users FOR SELECT
TO authenticated
USING (auth.uid() = blocker_id);

-- Clients can insert their own blocked users
CREATE POLICY "Users insert own blocked users"
ON blocked_users FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = blocker_id);

-- Clients can delete their own blocked users
CREATE POLICY "Users delete own blocked users"
ON blocked_users FOR DELETE
TO authenticated
USING (auth.uid() = blocker_id);

-- Service role for admin
CREATE POLICY "Service role manage blocked_users"
ON blocked_users FOR ALL
TO service_role
USING (true);

-- ============================================================
-- 7. PUSH_SUBSCRIPTIONS TABLE POLICIES
-- ============================================================

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can view own push subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON push_subscriptions;

-- Clients can view their own push subscriptions
CREATE POLICY "Users view own push subscriptions"
ON push_subscriptions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Clients can insert their own push subscriptions
CREATE POLICY "Users insert own push subscriptions"
ON push_subscriptions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Clients can delete their own push subscriptions
CREATE POLICY "Users delete own push subscriptions"
ON push_subscriptions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Service role for admin
CREATE POLICY "Service role manage push_subscriptions"
ON push_subscriptions FOR ALL
TO service_role
USING (true);

-- ============================================================
-- 8. USER_REPORTS TABLE POLICIES
-- ============================================================

ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public access" ON user_reports;
DROP POLICY IF EXISTS "Users can view own reports" ON user_reports;
DROP POLICY IF EXISTS "Users can insert own reports" ON user_reports;
DROP POLICY IF EXISTS "Users can update own reports" ON user_reports;
DROP POLICY IF EXISTS "Users can delete own reports" ON user_reports;
DROP POLICY IF EXISTS "Users can manage own reports" ON user_reports;

-- Clients can view their own reports
CREATE POLICY "Users view own reports"
ON user_reports FOR SELECT
TO authenticated
USING (auth.uid() = reporter_id);

-- Clients can insert their own reports
CREATE POLICY "Users insert own reports"
ON user_reports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reporter_id);

-- Clients can delete their own reports
CREATE POLICY "Users delete own reports"
ON user_reports FOR DELETE
TO authenticated
USING (auth.uid() = reporter_id);

-- Service role for admin
CREATE POLICY "Service role manage user_reports"
ON user_reports FOR ALL
TO service_role
USING (true);

-- ============================================================
-- 9. GRANT PERMISSIONS
-- ============================================================

GRANT ALL ON notification_preferences TO authenticated, service_role;
GRANT ALL ON notifications TO authenticated, service_role;
GRANT ALL ON profile_interests TO authenticated, service_role;
GRANT ALL ON profile_shortlists TO authenticated, service_role;
GRANT ALL ON profile_views TO authenticated, service_role;
GRANT ALL ON blocked_users TO authenticated, service_role;
GRANT ALL ON push_subscriptions TO authenticated, service_role;
GRANT ALL ON user_reports TO authenticated, service_role;

-- ============================================================
-- 10. VERIFICATION
-- ============================================================

-- List all RLS policies
SELECT 
    tablename, 
    policyname, 
    cmd, 
    CASE 
        WHEN roles::text[] @> '{authenticated}' THEN 'authenticated'
        WHEN roles::text[] @> '{service_role}' THEN 'service_role'
        ELSE 'other'
    END as target_role
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
    'notification_preferences', 
    'notifications', 
    'profile_interests', 
    'profile_shortlists', 
    'profile_views',
    'blocked_users',
    'push_subscriptions',
    'user_reports'
)
ORDER BY tablename, cmd;
