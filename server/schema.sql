-- Forge backend schema (Postgres / Supabase).
--
-- The clients treat this as the source of truth for a project; `packages/core`
-- mirrors these shapes. Object storage holds the binaries under
--   projects/{project_id}/assets/{asset_id}/{version}/mesh.glb
--   projects/{project_id}/assets/{asset_id}/{version}/textures/*
--   projects/{project_id}/assets/{asset_id}/clips/{clip}.glb

create extension if not exists "pgcrypto";

create type device_kind as enum ('desktop', 'android');
create type clip_status as enum ('approved', 'review', 'rework');
create type job_stage   as enum ('understanding', 'shape', 'retopo_uv', 'texturing', 'checks');
create type job_state   as enum ('queued', 'running', 'done', 'failed');

create table projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  defaults    jsonb not null default '{}'::jsonb,   -- engine, style, triBudget, textures
  created_at  timestamptz not null default now()
);

create table project_members (
  project_id  uuid not null references projects (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'editor',
  primary key (project_id, user_id)
);

create table devices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  name         text not null,
  kind         device_kind not null,
  app_version  text,
  last_seen_at timestamptz not null default now(),
  -- Short-lived pairing code shown by the desktop app; the phone redeems it.
  link_code    text,
  link_expires timestamptz
);

create table assets (
  id          text primary key,               -- client-generated, so offline creates work
  project_id  uuid not null references projects (id) on delete cascade,
  name        text not null,
  category    text not null,
  kind        text not null,
  variant     int  not null default 0,
  device      device_kind not null,
  cur         int  not null default 0,        -- index of the displayed version
  updated_at  timestamptz not null default now()
);
create index assets_project_updated_idx on assets (project_id, updated_at desc);

-- Versions are append-only. A concurrent edit from another device becomes a
-- sibling version; nothing is ever overwritten.
create table asset_versions (
  id          uuid primary key default gen_random_uuid(),
  asset_id    text not null references assets (id) on delete cascade,
  idx         int  not null,
  label       text not null,                  -- v1, v2, …
  tris        text not null,
  mats        int  not null default 1,
  note        text not null,
  size        text not null,
  prompt      text not null,
  device      device_kind not null,
  file_url    text,
  created_at  timestamptz not null default now(),
  unique (asset_id, idx)
);

create table asset_clips (
  id          uuid primary key default gen_random_uuid(),
  asset_id    text not null references assets (id) on delete cascade,
  name        text not null,                  -- idle | walk | run | drive | attack | hurt | spin
  status      clip_status not null default 'review',
  clip_url    text,
  updated_at  timestamptz not null default now(),
  unique (asset_id, name)
);

create table jobs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects (id) on delete cascade,
  asset_id    text references assets (id) on delete cascade,
  kind        text not null,                  -- generate_mesh | generate_clip | retopologize | …
  state       job_state not null default 'queued',
  stage       job_stage not null default 'understanding',
  percent     int  not null default 0,
  request     jsonb not null,                 -- the AgentRequest as submitted
  result      jsonb,                          -- the AgentResponse
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index jobs_project_state_idx on jobs (project_id, state);

-- ---------------------------------------------------------------------------
-- Row level security: a row is reachable only through a project you belong to.
-- ---------------------------------------------------------------------------

alter table projects        enable row level security;
alter table project_members enable row level security;
alter table devices         enable row level security;
alter table assets          enable row level security;
alter table asset_versions  enable row level security;
alter table asset_clips     enable row level security;
alter table jobs            enable row level security;

create or replace function is_member(p uuid) returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from project_members m
    where m.project_id = p and m.user_id = auth.uid()
  );
$$;

create policy project_read   on projects        for select using (is_member(id));
create policy project_write  on projects        for all    using (owner_id = auth.uid());
create policy members_read   on project_members for select using (is_member(project_id));
create policy devices_own    on devices         for all    using (user_id = auth.uid());
create policy assets_rw      on assets          for all    using (is_member(project_id));
create policy versions_rw    on asset_versions  for all
  using (exists (select 1 from assets a where a.id = asset_id and is_member(a.project_id)));
create policy clips_rw       on asset_clips     for all
  using (exists (select 1 from assets a where a.id = asset_id and is_member(a.project_id)));
create policy jobs_rw        on jobs            for all    using (is_member(project_id));

-- Realtime: clients subscribe filtered by project_id.
alter publication supabase_realtime add table assets, asset_versions, asset_clips, jobs;
