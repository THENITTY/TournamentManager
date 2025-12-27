-- FIX: Infinite Recursion in RLS Policies & Activate Admin

-- 1. Create a secure function to check admin status without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
$$;

-- 2. Drop the problematic recursive policies
DROP POLICY IF EXISTS "Super Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super Admins can update all profiles" ON public.profiles;

-- 3. Re-create policies using the secure function
CREATE POLICY "Super Admins can view all profiles"
ON public.profiles FOR SELECT
USING ( is_super_admin() );

CREATE POLICY "Super Admins can update all profiles"
ON public.profiles FOR UPDATE
USING ( is_super_admin() );

-- 4. Manually promote Marco Granieri to 'active' status
UPDATE public.profiles
SET status = 'active'
WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'marcogranieri@libero.it'
);
