-- Remove all references to the test instance "CDETeste21973183599"

-- 1. Clear metadata references in messages
UPDATE public.messages 
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'),
  '{evolutionInstance}',
  'null'::jsonb
)
WHERE metadata->>'evolutionInstance' = 'CDETeste21973183599';

-- 2. Clear evolution_instance from conversations
UPDATE public.conversations 
SET evolution_instance = NULL 
WHERE evolution_instance = 'CDETeste21973183599';

-- 3. Clear default_instance from org settings
UPDATE public.org_messaging_settings 
SET default_instance = NULL 
WHERE default_instance = 'CDETeste21973183599';

-- 4. Clear default_channel from system_users where it references this instance
UPDATE public.system_users 
SET default_channel = NULL 
WHERE default_channel IN (
  SELECT id FROM public.channels WHERE instance = 'CDETeste21973183599'
);

-- 5. Delete user assignments for this instance
DELETE FROM public.instance_user_assignments 
WHERE instance = 'CDETeste21973183599';

-- 6. Delete the channel record for this instance
DELETE FROM public.channels 
WHERE instance = 'CDETeste21973183599';

-- 7. Delete the instance token for this instance
DELETE FROM public.evolution_instance_tokens 
WHERE instance_name = 'CDETeste21973183599';