-- SECURE TOURNAMENT PERMISSIONS
-- Objective: Allow Admins/SuperAdmins to manage. Allow others only to read.

-- 1. Ensure Functions are Robust (Handle Enum/Text types safely)
CREATE OR REPLACE FUNCTION public.check_is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role::text = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.check_is_league_admin(current_league_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM league_members
    WHERE league_id = current_league_id
    AND user_id = auth.uid()
    AND role::text = 'admin'
  );
$$;

-- 2. Reset Policies for Tournaments
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

-- Drop any previous debug/permissive policies
DROP POLICY IF EXISTS "Debug: Allow All Writes" ON public.tournaments;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.tournaments;
DROP POLICY IF EXISTS "Admins can create tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Admins can update tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Admins can delete tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Admins can manage tournaments" ON public.tournaments;

-- 3. Define Final Policies

-- A. READ: Everyone can see tournaments
CREATE POLICY "Everyone can view tournaments"
ON public.tournaments FOR SELECT TO authenticated
USING (true);

-- B. INSERT: Only Super Admins or League Admins
CREATE POLICY "Admins can create tournaments"
ON public.tournaments FOR INSERT TO authenticated
WITH CHECK (
    public.check_is_super_admin() OR 
    public.check_is_league_admin(league_id)
);

-- C. UPDATE: Only Super Admins or League Admins
CREATE POLICY "Admins can update tournaments"
ON public.tournaments FOR UPDATE TO authenticated
USING (
    public.check_is_super_admin() OR 
    public.check_is_league_admin(league_id)
);

-- D. DELETE: Only Super Admins or League Admins
CREATE POLICY "Admins can delete tournaments"
ON public.tournaments FOR DELETE TO authenticated
USING (
    public.check_is_super_admin() OR 
    public.check_is_league_admin(league_id)
);
