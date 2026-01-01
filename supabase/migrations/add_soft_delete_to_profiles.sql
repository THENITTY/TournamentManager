-- Add soft delete support to profiles table
-- This allows kicking users while preserving historical data

-- Add deleted_at column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Create index for performance (filtering non-deleted users)
CREATE INDEX IF NOT EXISTS idx_profiles_deleted_at ON public.profiles(deleted_at);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.deleted_at IS 'Timestamp when user was kicked/deleted. NULL = active user. Allows re-registration while preserving historical data.';
