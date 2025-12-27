-- Activate the Super Admin user based on email
-- This is necessary because new users are 'pending' by default, 
-- and we found the Super Admin was also created as 'pending'.

UPDATE public.profiles
SET status = 'active'
WHERE id IN (
    SELECT id FROM auth.users WHERE email = 'marcogranieri@libero.it'
);
