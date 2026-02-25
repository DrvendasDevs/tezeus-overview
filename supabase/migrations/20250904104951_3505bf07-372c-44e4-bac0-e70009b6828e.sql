-- Add evolution_url column to evolution_instance_tokens table
ALTER TABLE public.evolution_instance_tokens 
ADD COLUMN evolution_url text NOT NULL DEFAULT 'https://evo.eventoempresalucrativa.com.br';