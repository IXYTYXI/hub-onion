-- 执行时间: 2026-07-22 18:45:00
-- 版本标识: 202607221845
-- 目的: 为技能包增加有序的相关文档链接

BEGIN;

ALTER TABLE public.skill_bundles
  ADD COLUMN IF NOT EXISTS documentation_links JSONB;

UPDATE public.skill_bundles
SET documentation_links = '[]'::jsonb
WHERE documentation_links IS NULL;

ALTER TABLE public.skill_bundles
  ALTER COLUMN documentation_links SET DEFAULT '[]'::jsonb,
  ALTER COLUMN documentation_links SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'skill_bundles_documentation_links_array'
      AND conrelid = 'public.skill_bundles'::regclass
  ) THEN
    ALTER TABLE public.skill_bundles
      ADD CONSTRAINT skill_bundles_documentation_links_array
      CHECK (jsonb_typeof(documentation_links) = 'array');
  END IF;
END
$$;

COMMENT ON COLUMN public.skill_bundles.documentation_links
  IS '按展示顺序保存的技能包相关文档链接对象数组';

COMMIT;
