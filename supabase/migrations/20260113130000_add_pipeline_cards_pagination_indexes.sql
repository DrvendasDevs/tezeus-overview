-- Improve performance for paginated pipeline cards fetches (by pipeline/column ordered by created_at)
-- Safe to run multiple times due to IF NOT EXISTS.

create index if not exists pipeline_cards_pipeline_id_column_id_created_at_idx
on public.pipeline_cards (pipeline_id, column_id, created_at desc);

create index if not exists pipeline_cards_column_id_created_at_idx
on public.pipeline_cards (column_id, created_at desc);

-- Helpful for direct lookup paths already used widely
create index if not exists pipeline_cards_conversation_id_idx
on public.pipeline_cards (conversation_id);

create index if not exists pipeline_cards_contact_id_idx
on public.pipeline_cards (contact_id);

