-- ClawHub PostgreSQL 数据库 Schema
-- Phase 1: skills + skill_versions 两表结构

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS pg_trgm;        -- 模糊搜索
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";    -- uuid_generate_v4()

-- ============================================
-- skills 表：存储技能基本信息
-- ============================================
CREATE TABLE IF NOT EXISTS skills (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug            TEXT UNIQUE NOT NULL,
    display_name    TEXT NOT NULL,
    description     TEXT DEFAULT '',
    tags            TEXT[] DEFAULT '{}',
    moderation_status TEXT DEFAULT 'active',
    latest_version_id UUID,
    stats_downloads BIGINT DEFAULT 0,
    stats_installs  BIGINT DEFAULT 0,
    stats_versions  INTEGER DEFAULT 0,
    is_deleted      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- skill_versions 表：存储技能版本信息
-- ============================================
CREATE TABLE IF NOT EXISTS skill_versions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    skill_id        UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    version         TEXT NOT NULL,
    changelog       TEXT DEFAULT '',
    files           JSONB NOT NULL,  -- [{path, size, storage_key, sha256, content_type}]
    parsed          JSONB,           -- 解析后的 SKILL.md frontmatter
    content_hash    TEXT,            -- 所有文件 sha256 的哈希，用于版本比对
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(skill_id, version)
);

-- ============================================
-- 索引：优化查询性能
-- ============================================

-- slug 查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_skills_slug ON skills(slug);

-- 模糊搜索优化（display_name）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_skills_display_name_trgm
    ON skills USING gin(display_name gin_trgm_ops);

-- 模糊搜索优化（description）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_skills_description_trgm
    ON skills USING gin(description gin_trgm_ops);

-- 版本查询优化
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_skill_versions_skill_id
    ON skill_versions(skill_id);

-- 唯一索引：确保 slug 唯一性（带删除过滤）
CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_slug_unique
    ON skills(slug) WHERE is_deleted = FALSE;

-- 版本索引：按创建时间排序
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_skill_versions_created_at
    ON skill_versions(created_at DESC);

-- ============================================
-- 触发器：自动更新 updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_skills_updated_at
    BEFORE UPDATE ON skills
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 视图：活跃技能（非删除且审核通过）
-- ============================================

CREATE OR REPLACE VIEW active_skills AS
SELECT * FROM skills
WHERE is_deleted = FALSE
  AND moderation_status = 'active';

-- ============================================
-- 注释说明
-- ============================================

COMMENT ON TABLE skills IS '存储 ClawHub 技能的基本信息';
COMMENT ON COLUMN skills.slug IS '技能的唯一标识符，用于 URL 和 CLI 命令';
COMMENT ON COLUMN skills.display_name IS '技能的显示名称';
COMMENT ON COLUMN skills.description IS '技能的简短描述';
COMMENT ON COLUMN skills.tags IS '技能标签数组，用于分类和搜索';
COMMENT ON COLUMN skills.moderation_status IS '审核状态：active, pending, rejected';
COMMENT ON COLUMN skills.latest_version_id IS '最新版本的 ID，指向 skill_versions 表';
COMMENT ON COLUMN skills.stats_downloads IS '下载次数统计';
COMMENT ON COLUMN skills.stats_installs IS '安装次数统计';
COMMENT ON COLUMN skills.stats_versions IS '版本数量统计';
COMMENT ON COLUMN skills.is_deleted IS '软删除标记';

COMMENT ON TABLE skill_versions IS '存储技能的版本信息';
COMMENT ON COLUMN skill_versions.version IS '语义化版本号（如 1.0.0）';
COMMENT ON COLUMN skill_versions.changelog IS '版本变更日志';
COMMENT ON COLUMN skill_versions.files IS '文件元数据数组，包含 path, size, storage_key, sha256, content_type';
COMMENT ON COLUMN skill_versions.parsed IS '解析后的 SKILL.md frontmatter';
COMMENT ON COLUMN skill_versions.content_hash IS '所有文件内容哈希的组合哈希，用于版本比对';
