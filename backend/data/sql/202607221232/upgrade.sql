-- 执行时间: 2026-07-22 12:32:00
-- 版本标识: 202607221232
-- 目的: 为 skill 增加有序的相关文档链接

BEGIN;

ALTER TABLE public.skills
  ADD COLUMN IF NOT EXISTS documentation_links JSONB;

UPDATE public.skills
SET documentation_links = '[]'::jsonb
WHERE documentation_links IS NULL;

ALTER TABLE public.skills
  ALTER COLUMN documentation_links SET DEFAULT '[]'::jsonb,
  ALTER COLUMN documentation_links SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'skills_documentation_links_array'
      AND conrelid = 'public.skills'::regclass
  ) THEN
    ALTER TABLE public.skills
      ADD CONSTRAINT skills_documentation_links_array
      CHECK (jsonb_typeof(documentation_links) = 'array');
  END IF;
END
$$;

COMMENT ON COLUMN public.skills.documentation_links
  IS '按展示顺序保存的相关文档链接对象数组';

COMMIT;
