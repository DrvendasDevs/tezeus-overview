-- Add connection_phone snapshot for conversations to keep track of the instance number used
alter table public.conversations
  add column if not exists connection_phone text;

-- Backfill with the current phone number of the related connection when available
update public.conversations c
set connection_phone = conn.phone_number
from public.connections conn
where c.connection_id = conn.id
  and conn.phone_number is not null
  and (c.connection_phone is null or c.connection_phone <> conn.phone_number);

-- Helpful index for lookups by phone
create index if not exists conversations_connection_phone_idx
  on public.conversations (connection_phone);

