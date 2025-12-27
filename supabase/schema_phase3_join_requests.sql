-- Add status column to league_members
ALTER TABLE league_members
ADD COLUMN status text NOT NULL DEFAULT 'pending'
CHECK (status IN ('pending', 'approved'));

-- Backfill existing members to approved (since they joined before this system)
UPDATE league_members SET status = 'approved';

-- Explicitly allow users to see their own pending requests, and admins to see all
-- (Existing Select policy likely covers this if it's "true" or checks member relation, but let's be safe later if needed)
