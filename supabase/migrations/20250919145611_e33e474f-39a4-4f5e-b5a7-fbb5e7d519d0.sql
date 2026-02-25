-- Tabela para mensagens rápidas (textos)
CREATE TABLE public.quick_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para áudios rápidos
CREATE TABLE public.quick_audios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  duration_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para mídias rápidas (imagens)
CREATE TABLE public.quick_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- image/jpeg, image/png, etc
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para documentos rápidos
CREATE TABLE public.quick_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  title TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- application/pdf, etc
  file_size INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS nas tabelas
ALTER TABLE public.quick_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_audios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_documents ENABLE ROW LEVEL SECURITY;

-- Criar políticas RLS para quick_messages
CREATE POLICY "Users can view quick messages in their workspace" ON public.quick_messages
FOR SELECT USING (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "Users can manage quick messages in their workspace" ON public.quick_messages
FOR ALL USING (is_workspace_member(workspace_id, 'user'::system_profile));

-- Criar políticas RLS para quick_audios
CREATE POLICY "Users can view quick audios in their workspace" ON public.quick_audios
FOR SELECT USING (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "Users can manage quick audios in their workspace" ON public.quick_audios
FOR ALL USING (is_workspace_member(workspace_id, 'user'::system_profile));

-- Criar políticas RLS para quick_media
CREATE POLICY "Users can view quick media in their workspace" ON public.quick_media
FOR SELECT USING (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "Users can manage quick media in their workspace" ON public.quick_media
FOR ALL USING (is_workspace_member(workspace_id, 'user'::system_profile));

-- Criar políticas RLS para quick_documents
CREATE POLICY "Users can view quick documents in their workspace" ON public.quick_documents
FOR SELECT USING (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "Users can manage quick documents in their workspace" ON public.quick_documents
FOR ALL USING (is_workspace_member(workspace_id, 'user'::system_profile));

-- Triggers para atualizar updated_at
CREATE TRIGGER update_quick_messages_updated_at
BEFORE UPDATE ON public.quick_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quick_audios_updated_at
BEFORE UPDATE ON public.quick_audios
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quick_media_updated_at
BEFORE UPDATE ON public.quick_media
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_quick_documents_updated_at
BEFORE UPDATE ON public.quick_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();