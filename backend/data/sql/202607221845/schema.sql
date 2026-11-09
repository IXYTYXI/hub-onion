--
-- PostgreSQL schema backup
-- Dumped before 202607221845 skill bundle documentation links upgrade.
-- Scope: public.skill_bundles (the only object changed by this upgrade).
--

CREATE TABLE public.skill_bundles (
    id uuid DEFAULT public.gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    display_name text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    owner_user_id uuid,
    stats_downloads bigint DEFAULT 0 NOT NULL,
    stats_installs bigint DEFAULT 0 NOT NULL,
    is_deleted boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.skill_bundles
    ADD CONSTRAINT skill_bundles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.skill_bundles
    ADD CONSTRAINT skill_bundles_owner_user_id_fkey
    FOREIGN KEY (owner_user_id) REFERENCES public.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_skill_bundles_slug_active
    ON public.skill_bundles USING btree (slug)
    WHERE (is_deleted = false);

CREATE INDEX idx_skill_bundles_owner_user_id
    ON public.skill_bundles USING btree (owner_user_id);

CREATE INDEX idx_skill_bundles_updated_at
    ON public.skill_bundles USING btree (updated_at DESC);

CREATE INDEX idx_skill_bundles_downloads
    ON public.skill_bundles USING btree (stats_downloads DESC);

CREATE TRIGGER update_skill_bundles_updated_at
    BEFORE UPDATE ON public.skill_bundles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
