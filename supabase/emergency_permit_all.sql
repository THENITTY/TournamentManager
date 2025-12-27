-- EMERGENCY DEBUG RLS
-- Allows ANY authenticated user to create tournaments.

-- 1. Ensure Table Permissions
GRANT ALL ON TABLE public.tournaments TO authenticated;
GRANT ALL ON TABLE public.tournaments TO service_role;

-- 2. Drop Strict Policies
DROP POLICY IF EXISTS "Admins can create tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Admins can update tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Admins can delete tournaments" ON public.tournaments;
DROP POLICY IF EXISTS "Admins can manage tournaments" ON public.tournaments;

-- 3. Create "Permissive" Policy for Debugging
-- WARNING: This allows any logged-in user to create any tournament
CREATE POLICY "Debug: Allow All Writes"
ON public.tournaments FOR ALL TO authenticated
USING (true)
WITH CHECK (true);
