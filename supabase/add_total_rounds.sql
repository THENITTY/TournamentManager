-- Add total_rounds column to tournaments table
ALTER TABLE tournaments 
ADD COLUMN total_rounds INTEGER DEFAULT NULL;

-- Update existing tournaments to have a default (e.g., 3 for now, or null)
-- We can leave it null until set, or default to 3.

-- No RLS update needed for column addition typically, unless explicit field permissions exist (not the case here, policy is row-based).
