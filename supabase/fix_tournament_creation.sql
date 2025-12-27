-- FIX TOURNAMENT RLS

-- 1. Drop the ambiguous 'FOR ALL' policy
DROP POLICY IF EXISTS "Admins can manage tournaments" ON public.tournaments;

-- 2. Explicit INSERT Policy (Crucial for creation)
-- Uses WITH CHECK to validate the NEW row's league_id against user permissions
CREATE POLICY "Admins can create tournaments"
ON public.tournaments FOR INSERT TO authenticated
WITH CHECK (
    public.is_super_admin() OR 
    public.is_league_admin(league_id)
);

-- 3. Explicit UPDATE Policy
CREATE POLICY "Admins can update tournaments"
ON public.tournaments FOR UPDATE TO authenticated
USING (
    public.is_super_admin() OR 
    public.is_league_admin(league_id)
);

-- 4. Explicit DELETE Policy
CREATE POLICY "Admins can delete tournaments"
ON public.tournaments FOR DELETE TO authenticated
USING (
    public.is_super_admin() OR 
    public.is_league_admin(league_id)
);

-- 5. Explicit SELECT Policy (Already exists as "Enable read access for all authenticated users", but ensuring it)
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.tournaments;
CREATE POLICY "Enable read access for all authenticated users"
ON public.tournaments FOR SELECT TO authenticated
USING (true);
