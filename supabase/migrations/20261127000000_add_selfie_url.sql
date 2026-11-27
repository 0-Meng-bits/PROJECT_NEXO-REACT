-- Add selfie_url column to account_details for live selfie verification
ALTER TABLE account_details ADD COLUMN IF NOT EXISTS selfie_url text;
