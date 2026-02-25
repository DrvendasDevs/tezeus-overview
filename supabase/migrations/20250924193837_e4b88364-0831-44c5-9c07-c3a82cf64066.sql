-- Ensure unique constraint on contact_tags to prevent duplicates
ALTER TABLE public.contact_tags 
ADD CONSTRAINT contact_tags_contact_tag_unique 
UNIQUE (contact_id, tag_id);