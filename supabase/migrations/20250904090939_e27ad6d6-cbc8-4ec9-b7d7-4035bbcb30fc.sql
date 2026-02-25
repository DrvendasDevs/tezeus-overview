-- 1. Create trigger for automatic password hashing
CREATE TRIGGER hash_system_user_password
  BEFORE INSERT OR UPDATE ON public.system_users
  FOR EACH ROW
  EXECUTE FUNCTION public.hash_user_password();

-- 2. Drop the overly permissive RLS policy
DROP POLICY IF EXISTS "Allow all operations on system_users" ON public.system_users;

-- 3. Create restrictive RLS policies for system_users
CREATE POLICY "Service role can manage system_users"
  ON public.system_users
  FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role')
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- 4. Create a secure view for displaying users without password
CREATE OR REPLACE VIEW public.system_users_view AS
SELECT 
  id,
  name,
  email,
  profile,
  status,
  avatar,
  cargo_id,
  created_at,
  updated_at
FROM public.system_users;