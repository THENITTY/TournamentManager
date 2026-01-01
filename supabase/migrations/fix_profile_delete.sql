-- Drop existing policy if it exists and recreate with correct permissions
DROP POLICY IF EXISTS "Super Admins can delete profiles" ON public.profiles;

CREATE POLICY "Super Admins can delete profiles"
ON public.profiles FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  )
);
