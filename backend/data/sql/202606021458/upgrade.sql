-- 执行时间: 2026-06-02 14:58:00
-- 版本标识: 202606021458
-- 数据库: clawhub_dev
-- 目的: 新增受管理的 skill 分类表和 skill 分类关联表；未分类由无关联状态表达

CREATE TABLE IF NOT EXISTS skill_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT skill_categories_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT skill_categories_slug_not_virtual CHECK (slug <> 'uncategorized')
);

CREATE INDEX IF NOT EXISTS idx_skill_categories_sort_order_slug
  ON skill_categories(sort_order ASC, slug ASC);

CREATE TABLE IF NOT EXISTS skill_category_assignments (
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES skill_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (skill_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_skill_category_assignments_category_skill
  ON skill_category_assignments(category_id, skill_id);
