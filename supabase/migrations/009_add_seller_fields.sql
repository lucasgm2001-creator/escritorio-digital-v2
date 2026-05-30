-- Add new fields to sellers table for meta, commission, and fixed salary
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS monthly_goal NUMERIC DEFAULT 0;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS default_commission NUMERIC DEFAULT 0;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS fixed_salary NUMERIC DEFAULT 0;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
ALTER TABLE sellers ADD COLUMN IF NOT EXISTS observations TEXT;
