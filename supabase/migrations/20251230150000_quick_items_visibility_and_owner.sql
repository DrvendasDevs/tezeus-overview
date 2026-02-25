-- Quick items: owner + shared visibility
-- Goal:
--  - Existing items remain visible to all (backfill visible_to_all=true)
--  - New items default to private (visible_to_all=false) and carry created_by_id
--  - Text messages optionally allow edit before sending (allow_edit_before_send)

-- 1) quick_messages (text)
alter table public.quick_messages
  add column if not exists created_by_id uuid,
  add column if not exists visible_to_all boolean not null default false,
  add column if not exists allow_edit_before_send boolean not null default false;

-- Existing rows were previously shared by workspace; keep that behavior.
update public.quick_messages
set visible_to_all = true
where visible_to_all = false;

create index if not exists idx_quick_messages_workspace_visible
  on public.quick_messages (workspace_id, visible_to_all);

create index if not exists idx_quick_messages_workspace_created_by
  on public.quick_messages (workspace_id, created_by_id);

-- 2) quick_audios
alter table public.quick_audios
  add column if not exists created_by_id uuid,
  add column if not exists visible_to_all boolean not null default false;

update public.quick_audios
set visible_to_all = true
where visible_to_all = false;

create index if not exists idx_quick_audios_workspace_visible
  on public.quick_audios (workspace_id, visible_to_all);

create index if not exists idx_quick_audios_workspace_created_by
  on public.quick_audios (workspace_id, created_by_id);

-- 3) quick_media
alter table public.quick_media
  add column if not exists created_by_id uuid,
  add column if not exists visible_to_all boolean not null default false;

update public.quick_media
set visible_to_all = true
where visible_to_all = false;

create index if not exists idx_quick_media_workspace_visible
  on public.quick_media (workspace_id, visible_to_all);

create index if not exists idx_quick_media_workspace_created_by
  on public.quick_media (workspace_id, created_by_id);

-- 4) quick_documents
alter table public.quick_documents
  add column if not exists created_by_id uuid,
  add column if not exists visible_to_all boolean not null default false;

update public.quick_documents
set visible_to_all = true
where visible_to_all = false;

create index if not exists idx_quick_documents_workspace_visible
  on public.quick_documents (workspace_id, visible_to_all);

create index if not exists idx_quick_documents_workspace_created_by
  on public.quick_documents (workspace_id, created_by_id);

-- 5) quick_funnels
alter table public.quick_funnels
  add column if not exists created_by_id uuid,
  add column if not exists visible_to_all boolean not null default false;

update public.quick_funnels
set visible_to_all = true
where visible_to_all = false;

create index if not exists idx_quick_funnels_workspace_visible
  on public.quick_funnels (workspace_id, visible_to_all);

create index if not exists idx_quick_funnels_workspace_created_by
  on public.quick_funnels (workspace_id, created_by_id);


