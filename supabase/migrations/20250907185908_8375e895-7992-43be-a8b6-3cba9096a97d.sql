-- Update the current_system_user_id function to work with custom auth system
CREATE OR REPLACE FUNCTION public.current_system_user_id()
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_id uuid;
  user_email text;
BEGIN
  -- Try to get system_user_id from JWT first
  user_id := (auth.jwt() ->> 'system_user_id')::uuid;
  IF user_id IS NOT NULL THEN
    RETURN user_id;
  END IF;
  
  -- Fall back to system_email, then email
  user_email := COALESCE(
    auth.jwt() ->> 'system_email',
    auth.jwt() ->> 'email'
  );
  
  IF user_email IS NOT NULL THEN
    SELECT su.id INTO user_id
    FROM public.system_users su
    WHERE su.email = user_email
    LIMIT 1;
  END IF;
  
  RETURN user_id;
END;
$function$;