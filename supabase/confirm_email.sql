-- Confirm email for Seto Kaiba (and others) to bypass email verification
-- This is useful for testing without sending real emails.

UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'setokaiba@gmail.com';

-- Optional: Confirm ALL users if you want to unblock everyone
-- UPDATE auth.users SET email_confirmed_at = now();
