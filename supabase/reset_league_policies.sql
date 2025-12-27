-- ==============================================================================
-- CLEAN SWEEP: Reset and Fix League Member Permissions (TEXT VERSION)
-- ==============================================================================

-- 1. Drop ALL existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view league members" ON league_members;
DROP POLICY IF EXISTS "Users can join leagues" ON league_members;
DROP POLICY IF EXISTS "Super Admins can update any league member" ON league_members;
DROP POLICY IF EXISTS "Super Admins can delete any league member" ON league_members;
DROP POLICY IF EXISTS "League Admins can update their league members" ON league_members;
DROP POLICY IF EXISTS "League Admins can delete their league members" ON league_members;
DROP POLICY IF EXISTS "League Admins can update valid members" ON league_members;
DROP POLICY IF EXISTS "League Admins can delete valid members" ON league_members;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON league_members;
DROP POLICY IF EXISTS "Super Admins can update anyone" ON league_members;
DROP POLICY IF EXISTS "League Admins can update subordinates" ON league_members;
DROP POLICY IF EXISTS "Super Admins can delete anyone" ON league_members;
DROP POLICY IF EXISTS "League Admins can delete subordinates" ON league_members;

-- Ensure RLS is enabled
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 2. HELPER FUNCTION (Security Definer)
-- This function runs with elevated privileges to check if a user is an admin of a league.
-- It bypasses RLS on league_members, preventing infinite recursion or "blind" spots.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.is_league_admin(_league_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM league_members
    WHERE league_id = _league_id
    AND user_id = auth.uid()
    AND role = 'admin'  -- NO CAST, treating as TEXT
  );
$$;

-- Helper for Super Admin (checks global profile)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin' -- NO CAST, treating as TEXT
  );
$$;

-- ==============================================================================
-- 3. NEW POLICIES
-- ==============================================================================

-- A. VIEW: Authenticated users can view ALL league memberships.
CREATE POLICY "Enable read access for all authenticated users"
ON league_members FOR SELECT TO authenticated
USING (true);

-- B. JOIN: Users can insert their OWN request
CREATE POLICY "Users can join leagues"
ON league_members FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
);

-- C. UPDATE (Manage Roles / Approve Members)
-- 1. Super Admin: Can update ANYONE
CREATE POLICY "Super Admins can update anyone"
ON league_members FOR UPDATE TO authenticated
USING ( is_super_admin() );

-- 2. League Admin: Can update 'user' and 'co_admin' in their league (NOT other admins)
CREATE POLICY "League Admins can update subordinates"
ON league_members FOR UPDATE TO authenticated
USING (
  is_league_admin(league_id)           -- I am an admin of this league
  AND role IN ('user', 'co_admin')     -- The TARGET is a User or Co-Admin
)
WITH CHECK (
  role != 'admin'                      -- I cannot promote someone TO 'admin'
);

-- D. DELETE (Kick Members / Reject Requests)
-- 1. Super Admin: Can delete ANYONE
CREATE POLICY "Super Admins can delete anyone"
ON league_members FOR DELETE TO authenticated
USING ( is_super_admin() );

-- 2. League Admin: Can delete 'user' and 'co_admin' in their league
CREATE POLICY "League Admins can delete subordinates"
ON league_members FOR DELETE TO authenticated
USING (
  is_league_admin(league_id)           -- I am an admin of this league
  AND role IN ('user', 'co_admin')     -- The TARGET is a User or Co-Admin
);
