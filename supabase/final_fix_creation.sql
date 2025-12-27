-- FINAL FIX FOR TOURNAMENT CREATION

-- 1. Ensure Table Permissions (Postgres Level)
GRANT ALL ON TABLE public.tournaments TO authenticated;
GRANT ALL ON TABLE public.tournaments TO service_role;

-- 2. Robust Admin Check Function (Handles Text/Enum ambiguity)
CREATE OR REPLACE FUNCTION public.is_league_admin_v2(_league_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM league_members
    WHERE league_id = _league_id
    AND user_id = auth.uid()
    AND (role::text = 'admin' OR role::text = 'super_admin') -- Check both just in case
  );
$$;

-- 3. Robust Super Admin Check
CREATE OR REPLACE FUNCTION public.is_super_admin_v2()
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


-- 4. Reset Policies on Tournaments
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can create tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Admins can update tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Admins can delete tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Admins can manage tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.tournaments;

-- 5. Create Fresh Policies
-- READ
CREATE POLICY "Enable read access for all authenticated users"
ON public.tournaments FOR SELECT TO authenticated
USING (true);

-- CREATE (Using V2 functions)
CREATE POLICY "Admins can create tournaments"
ON public.tournaments FOR INSERT TO authenticated
WITH CHECK (
    public.is_super_admin_v2() OR 
    public.is_league_admin_v2(league_id)
);

-- UPDATE
CREATE POLICY "Admins can update tournaments"
ON public.tournaments FOR UPDATE TO authenticated
USING (
    public.is_super_admin_v2() OR 
    public.is_league_admin_v2(league_id)
);

-- DELETE
CREATE POLICY "Admins can delete tournaments"
ON public.tournaments FOR DELETE TO authenticated
USING (
    public.is_super_admin_v2() OR 
    public.is_league_admin_v2(league_id)
);
