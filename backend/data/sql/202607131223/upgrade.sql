-- 执行时间：2026-07-13 12:23:56
-- 将测试环境遗留的 skill_bundles 结构升级到当前 Skill Bundle 模型。

BEGIN;

DO $$
DECLARE
  has_name BOOLEAN;
  has_display_name BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'skill_bundles'
      AND column_name = 'name'
  ) INTO has_name;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'skill_bundles'
      AND column_name = 'display_name'
  ) INTO has_display_name;

  IF has_name AND NOT has_display_name THEN
    ALTER TABLE skill_bundles RENAME COLUMN name TO display_name;
  ELSIF has_name AND has_display_name THEN
    EXECUTE '
      UPDATE skill_bundles
      SET display_name = COALESCE(NULLIF(display_name, ''''), name)
      WHERE display_name IS NULL OR display_name = ''''
    ';
    ALTER TABLE skill_bundles DROP COLUMN name;
  ELSIF NOT has_display_name THEN
    ALTER TABLE skill_bundles ADD COLUMN display_name TEXT;
  END IF;
END
$$;

UPDATE skill_bundles
SET display_name = slug
WHERE display_name IS NULL OR display_name = '';

ALTER TABLE skill_bundles
  ALTER COLUMN display_name SET NOT NULL,
  ALTER COLUMN description SET DEFAULT '',
  ALTER COLUMN owner_user_id DROP NOT NULL;

ALTER TABLE skill_bundles
  ADD COLUMN IF NOT EXISTS stats_downloads BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stats_installs BIGINT NOT NULL DEFAULT 0;

ALTER TABLE skill_bundles
  DROP CONSTRAINT IF EXISTS skill_bundles_owner_user_id_fkey,
  DROP CONSTRAINT IF EXISTS skill_bundles_slug_key;

ALTER TABLE skill_bundles
  ADD CONSTRAINT skill_bundles_owner_user_id_fkey
    FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;

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
  sort_order INTEGER NOT NULL DEFAULT 0,
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

DO $$
BEGIN
  IF to_regclass('public.skill_bundle_skills') IS NOT NULL THEN
    EXECUTE '
      INSERT INTO bundle_skills (bundle_id, skill_slug, sort_order, created_at)
      SELECT legacy.bundle_id, skills.slug, legacy.sort_order, legacy.created_at
      FROM skill_bundle_skills AS legacy
      JOIN skills ON skills.id = legacy.skill_id
      ON CONFLICT (bundle_id, skill_slug) DO UPDATE
      SET sort_order = EXCLUDED.sort_order
    ';
  END IF;

  IF to_regclass('public.skill_bundle_categories') IS NOT NULL THEN
    EXECUTE '
      INSERT INTO bundle_category_assignments (bundle_id, category_id, created_at)
      SELECT bundle_id, category_id, created_at
      FROM skill_bundle_categories
      ON CONFLICT (bundle_id, category_id) DO NOTHING
    ';
  END IF;
END
$$;

INSERT INTO skill_categories (id, slug, name, description, sort_order)
VALUES
  (gen_random_uuid(), 'dev-tools', '开发工具', '开发相关的工具与辅助技能', 1),
  (gen_random_uuid(), 'productivity', '效率提升', '提升工作效率的技能', 2),
  (gen_random_uuid(), 'ai-agent', 'AI Agent', 'AI Agent 相关的技能', 3),
  (gen_random_uuid(), 'data-analysis', '数据分析', '数据处理与分析相关技能', 4),
  (gen_random_uuid(), 'documentation', '文档协作', '文档编写与协作相关技能', 5)
ON CONFLICT (slug) DO NOTHING;

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

COMMIT;
