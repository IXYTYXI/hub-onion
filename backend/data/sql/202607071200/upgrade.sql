-- 执行时间: 2026-07-07 12:00:00
-- 版本标识: 202607071200
-- 数据库: clawhub_dev
-- 目的: 新增技能包（Skill Bundle）相关表、索引和默认分类数据

-- 技能包主表
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

-- 技能包-技能关联表
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

-- 技能包-分类关联表
CREATE TABLE IF NOT EXISTS bundle_category_assignments (
    bundle_id UUID NOT NULL REFERENCES skill_bundles(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES skill_categories(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (bundle_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_bundle_category_assignments_category_id
    ON bundle_category_assignments(category_id);

-- 技能包更新时间触发器
DROP TRIGGER IF EXISTS update_skill_bundles_updated_at ON skill_bundles;
CREATE TRIGGER update_skill_bundles_updated_at
    BEFORE UPDATE ON skill_bundles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 确保默认分类数据存在（针对现有数据库）
INSERT INTO skill_categories (id, slug, name, description, sort_order)
VALUES
    (gen_random_uuid(), 'dev-tools', '开发工具', '开发相关的工具与辅助技能', 1),
    (gen_random_uuid(), 'productivity', '效率提升', '提升工作效率的技能', 2),
    (gen_random_uuid(), 'ai-agent', 'AI Agent', 'AI Agent 相关的技能', 3),
    (gen_random_uuid(), 'data-analysis', '数据分析', '数据处理与分析相关技能', 4),
    (gen_random_uuid(), 'documentation', '文档协作', '文档编写与协作相关技能', 5)
ON CONFLICT (slug) DO NOTHING;
