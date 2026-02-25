-- Desabilitar RLS e remover políticas das tabelas quick_*

-- Remover políticas existentes da tabela quick_messages
DROP POLICY IF EXISTS "Users can view their own quick messages" ON public.quick_messages;
DROP POLICY IF EXISTS "Users can create their own quick messages" ON public.quick_messages;
DROP POLICY IF EXISTS "Users can update their own quick messages" ON public.quick_messages;
DROP POLICY IF EXISTS "Users can delete their own quick messages" ON public.quick_messages;

-- Desabilitar RLS na tabela quick_messages
ALTER TABLE public.quick_messages DISABLE ROW LEVEL SECURITY;

-- Remover políticas existentes da tabela quick_audios
DROP POLICY IF EXISTS "Users can view their own quick audios" ON public.quick_audios;
DROP POLICY IF EXISTS "Users can create their own quick audios" ON public.quick_audios;
DROP POLICY IF EXISTS "Users can update their own quick audios" ON public.quick_audios;
DROP POLICY IF EXISTS "Users can delete their own quick audios" ON public.quick_audios;

-- Desabilitar RLS na tabela quick_audios
ALTER TABLE public.quick_audios DISABLE ROW LEVEL SECURITY;

-- Remover políticas existentes da tabela quick_media
DROP POLICY IF EXISTS "Users can view their own quick media" ON public.quick_media;
DROP POLICY IF EXISTS "Users can create their own quick media" ON public.quick_media;
DROP POLICY IF EXISTS "Users can update their own quick media" ON public.quick_media;
DROP POLICY IF EXISTS "Users can delete their own quick media" ON public.quick_media;

-- Desabilitar RLS na tabela quick_media
ALTER TABLE public.quick_media DISABLE ROW LEVEL SECURITY;

-- Remover políticas existentes da tabela quick_documents
DROP POLICY IF EXISTS "Users can view their own quick documents" ON public.quick_documents;
DROP POLICY IF EXISTS "Users can create their own quick documents" ON public.quick_documents;
DROP POLICY IF EXISTS "Users can update their own quick documents" ON public.quick_documents;
DROP POLICY IF EXISTS "Users can delete their own quick documents" ON public.quick_documents;

-- Desabilitar RLS na tabela quick_documents
ALTER TABLE public.quick_documents DISABLE ROW LEVEL SECURITY;