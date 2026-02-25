-- Adicionar campo default_channel na tabela system_users
ALTER TABLE public.system_users 
ADD COLUMN default_channel UUID REFERENCES public.channels(id);