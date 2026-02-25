-- Create function to sync system_users profile to user_roles
CREATE OR REPLACE FUNCTION public.sync_user_roles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert roles based on system_users.profile where not already exists
  INSERT INTO public.user_roles (user_id, role)
  SELECT 
    su.id,
    CASE 
      WHEN su.profile = 'master' THEN 'master'::app_role
      WHEN su.profile = 'admin' THEN 'admin'::app_role
      ELSE 'user'::app_role
    END
  FROM public.system_users su
  WHERE su.status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur 
      WHERE ur.user_id = su.id
    );
END;
$$;

-- Execute the sync function
SELECT public.sync_user_roles();