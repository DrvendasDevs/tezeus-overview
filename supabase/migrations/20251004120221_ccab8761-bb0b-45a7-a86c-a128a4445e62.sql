-- Adicionar campo created_by na tabela contact_tags para rastrear quem atribuiu a tag
ALTER TABLE public.contact_tags 
ADD COLUMN created_by uuid REFERENCES public.system_users(id);

-- Criar índice para melhorar performance de queries filtradas por created_by
CREATE INDEX idx_contact_tags_created_by ON public.contact_tags(created_by);

-- Atualizar registros existentes para definir created_by como NULL (histórico sem rastreamento)
-- Novos registros deverão sempre ter created_by preenchido