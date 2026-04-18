-- Migration: Create profile_section_config table
-- Purpose: Store client profile section labels for dynamic navigation dropdown

CREATE TABLE IF NOT EXISTS profile_section_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    section_key TEXT NOT NULL UNIQUE,
    section_label TEXT NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default sections if table is empty
INSERT INTO profile_section_config (section_key, section_label, display_order)
SELECT * FROM (VALUES
    ('personal_details', 'Personal Details', 1),
    ('career_education', 'Career & Education', 2),
    ('location', 'Location', 3),
    ('family_details', 'Family Details', 4)
) AS v(section_key, section_label, display_order)
WHERE NOT EXISTS (SELECT 1 FROM profile_section_config);

-- Enable RLS
ALTER TABLE profile_section_config ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read sections (public dropdown data)
CREATE POLICY "Allow read access to profile_section_config"
ON profile_section_config FOR SELECT
USING (true);

-- Policy: Only authenticated users can insert/update/delete
CREATE POLICY "Allow authenticated access to profile_section_config"
ON profile_section_config FOR ALL
USING (auth.role() = 'authenticated');

-- Add updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profile_section_config_updated_at
    BEFORE UPDATE ON profile_section_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();