-- Adicionar campo para controle de tentativas de fetch de profile image
ALTER TABLE public.contacts 
ADD COLUMN profile_fetch_attempts INTEGER DEFAULT 0,
ADD COLUMN profile_fetch_last_attempt TIMESTAMP WITH TIME ZONE DEFAULT NULL;