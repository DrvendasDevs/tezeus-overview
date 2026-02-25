-- Atualizar a constraint de status para incluir 'paused'
ALTER TABLE public.system_users 
DROP CONSTRAINT IF EXISTS check_status_valid;

ALTER TABLE public.system_users 
ADD CONSTRAINT check_status_valid 
CHECK (status IN ('active', 'inactive', 'suspended', 'paused'));