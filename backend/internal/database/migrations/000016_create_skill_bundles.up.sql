CREATE TABLE IF NOT EXISTS skill_bundles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    stats_downloads BIGINT NOT NULL DEFAULT 0,
    stats_installs BIGINT NOT NULL DEFAULT 0,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_skill_bundles_slug_active
    ON skill_bundles(slug) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_skill_bundles_owner_user_id
    ON skill_bundles(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_skill_bundles_updated_at
    ON skill_bundles(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_bundles_downloads
    ON skill_bundles(stats_downloads DESC);

CREATE TABLE IF NOT EXISTS bundle_skills (
    bundle_id UUID NOT NULL REFERENCES skill_bundles(id) ON DELETE CASCADE,
    skill_slug TEXT NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (bundle_id, skill_slug)
);

CREATE INDEX IF NOT EXISTS idx_bundle_skills_bundle_order
    ON bundle_skills(bundle_id, sort_order ASC, skill_slug ASC);
CREATE INDEX IF NOT EXISTS idx_bundle_skills_slug
    ON bundle_skills(skill_slug);

CREATE TABLE IF NOT EXISTS bundle_category_assignments (
    bundle_id UUID NOT NULL REFERENCES skill_bundles(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES skill_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (bundle_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_bundle_category_assignments_category_id
    ON bundle_category_assignments(category_id);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_skill_bundles_updated_at ON skill_bundles;
CREATE TRIGGER update_skill_bundles_updated_at
    BEFORE UPDATE ON skill_bundles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
