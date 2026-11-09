-- 执行时间: 2026-06-02 17:33:00
-- 版本标识: 202606021733
-- 数据库: clawhub_dev
-- 目的: 新增动态 superuser 飞书邮箱授权表

CREATE TABLE IF NOT EXISTS superuser_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'feishu',
  email TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT superuser_grants_email_not_blank CHECK (btrim(email) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_superuser_grants_provider_email
  ON superuser_grants(provider, lower(email));
