-- Create function to fix phone numbers in contacts table
CREATE OR REPLACE FUNCTION fix_phone_numbers_from_remote_jid()
RETURNS TABLE(
  contact_id uuid,
  old_phone text,
  new_phone text,
  workspace_id uuid,
  action_taken text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH phone_fixes AS (
    SELECT 
      c.id as contact_id,
      c.phone as old_phone,
      CASE 
        -- Handle @lid suffix (LinkedIn imported contacts)
        WHEN c.phone LIKE '%@lid' THEN 
          regexp_replace(c.phone, '@lid$', '')
        -- Handle @s.whatsapp.net suffix  
        WHEN c.phone LIKE '%@s.whatsapp.net' THEN 
          regexp_replace(c.phone, '@s\.whatsapp\.net$', '')
        -- Handle @g.us suffix (group chats)
        WHEN c.phone LIKE '%@g.us' THEN 
          regexp_replace(c.phone, '@g\.us$', '')
        -- Handle @broadcast suffix
        WHEN c.phone LIKE '%@broadcast' THEN 
          regexp_replace(c.phone, '@broadcast$', '')
        -- Handle @c.us suffix
        WHEN c.phone LIKE '%@c.us' THEN 
          regexp_replace(c.phone, '@c\.us$', '')
        ELSE c.phone
      END as new_phone,
      c.workspace_id,
      CASE 
        WHEN c.phone ~ '@(lid|s\.whatsapp\.net|g\.us|broadcast|c\.us)$' THEN 'needs_fix'
        ELSE 'no_action_needed'
      END as action_needed
    FROM contacts c
    WHERE c.phone ~ '@(lid|s\.whatsapp\.net|g\.us|broadcast|c\.us)$'
  )
  SELECT 
    pf.contact_id,
    pf.old_phone,
    regexp_replace(pf.new_phone, '[^0-9]', '', 'g') as new_phone, -- Remove all non-digits
    pf.workspace_id,
    'fixed' as action_taken
  FROM phone_fixes pf
  WHERE pf.action_needed = 'needs_fix';
END;
$$;

-- Create function to actually update the phone numbers
CREATE OR REPLACE FUNCTION update_fixed_phone_numbers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count integer := 0;
  fix_record record;
BEGIN
  -- Loop through all contacts that need fixing
  FOR fix_record IN 
    SELECT contact_id, old_phone, new_phone, workspace_id
    FROM fix_phone_numbers_from_remote_jid()
  LOOP
    -- Check if a contact with the correct phone already exists in the same workspace
    IF EXISTS (
      SELECT 1 FROM contacts 
      WHERE phone = fix_record.new_phone 
      AND workspace_id = fix_record.workspace_id
      AND id != fix_record.contact_id
    ) THEN
      -- If duplicate exists, we need to merge conversations and delete the incorrect contact
      -- First, update all conversations to point to the correct contact
      UPDATE conversations 
      SET contact_id = (
        SELECT id FROM contacts 
        WHERE phone = fix_record.new_phone 
        AND workspace_id = fix_record.workspace_id
        AND id != fix_record.contact_id
        LIMIT 1
      )
      WHERE contact_id = fix_record.contact_id;
      
      -- Update all activities to point to the correct contact
      UPDATE activities
      SET contact_id = (
        SELECT id FROM contacts 
        WHERE phone = fix_record.new_phone 
        AND workspace_id = fix_record.workspace_id
        AND id != fix_record.contact_id
        LIMIT 1
      )
      WHERE contact_id = fix_record.contact_id;
      
      -- Update contact_tags to point to the correct contact
      UPDATE contact_tags
      SET contact_id = (
        SELECT id FROM contacts 
        WHERE phone = fix_record.new_phone 
        AND workspace_id = fix_record.workspace_id
        AND id != fix_record.contact_id
        LIMIT 1
      )
      WHERE contact_id = fix_record.contact_id;
      
      -- Delete the incorrect contact
      DELETE FROM contacts WHERE id = fix_record.contact_id;
      
    ELSE
      -- No duplicate exists, just update the phone number
      UPDATE contacts 
      SET phone = fix_record.new_phone,
          updated_at = now()
      WHERE id = fix_record.contact_id;
    END IF;
    
    updated_count := updated_count + 1;
  END LOOP;
  
  RETURN updated_count;
END;
$$;