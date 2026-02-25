-- Persist Linked Device IDs (LID) from WhatsApp/Z-API so we can resolve @lid payloads
-- into real contact phone numbers for routing/conversation management.

alter table public.contacts
add column if not exists whatsapp_lid text;

-- Helpful index for lookups when Z-API sends only @lid identifiers
create index if not exists contacts_workspace_whatsapp_lid_idx
  on public.contacts (workspace_id, whatsapp_lid);


