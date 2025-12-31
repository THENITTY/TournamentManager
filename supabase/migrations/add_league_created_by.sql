-- Add created_by column to leagues table
ALTER TABLE leagues 
ADD COLUMN created_by UUID REFERENCES profiles(id);

-- Optional: Update existing leagues to be owned by the first admin member found? 
-- Or just leave null. Let's leave null for now or manual update.
