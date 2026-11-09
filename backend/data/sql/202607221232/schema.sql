--
-- PostgreSQL schema backup
-- Dumped before 202607221232 skill documentation links upgrade.
-- Scope: public.skills (the only object changed by this upgrade).
--

CREATE TABLE public.skills (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    slug text NOT NULL,
    display_name text NOT NULL,
    description text DEFAULT ''::text,
    tags text[] DEFAULT '{}'::text[],
    moderation_status text DEFAULT 'active'::text,
    latest_version_id uuid,
    stats_downloads bigint DEFAULT 0,
    stats_installs bigint DEFAULT 0,
    stats_versions integer DEFAULT 0,
    is_deleted boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    owner_user_id uuid,
    stats_stars integer DEFAULT 0 NOT NULL,
    is_highlighted boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_slug_key UNIQUE (slug);

CREATE INDEX idx_skills_description_trgm
    ON public.skills USING gin (description public.gin_trgm_ops);

CREATE INDEX idx_skills_display_name_trgm
    ON public.skills USING gin (display_name public.gin_trgm_ops);

CREATE INDEX idx_skills_highlighted_active_updated_id
    ON public.skills USING btree (updated_at DESC, id DESC)
    WHERE ((is_deleted = false) AND (moderation_status = 'active'::text) AND (is_highlighted = true));

CREATE INDEX idx_skills_owner_not_deleted_updated_at
    ON public.skills USING btree (owner_user_id, updated_at DESC)
    WHERE (is_deleted = false);

CREATE INDEX idx_skills_owner_user_id
    ON public.skills USING btree (owner_user_id);

CREATE INDEX idx_skills_slug
    ON public.skills USING btree (slug);

CREATE UNIQUE INDEX idx_skills_slug_unique
    ON public.skills USING btree (slug)
    WHERE (is_deleted = false);

CREATE TRIGGER update_skills_updated_at
    BEFORE UPDATE ON public.skills
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE ONLY public.skills
    ADD CONSTRAINT skills_owner_user_id_fkey
    FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
