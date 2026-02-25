-- Criar tabela de pipelines
CREATE TABLE public.pipelines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'padrao',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de colunas do pipeline
CREATE TABLE public.pipeline_columns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#808080',
  order_position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de cards do pipeline
CREATE TABLE public.pipeline_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_id UUID NOT NULL REFERENCES public.pipelines(id) ON DELETE CASCADE,
  column_id UUID NOT NULL REFERENCES public.pipeline_columns(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  value NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'aberto',
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipeline_cards ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para pipelines
CREATE POLICY "Users can view pipelines in their workspace" 
ON public.pipelines 
FOR SELECT 
USING (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "Admins can manage pipelines in their workspace" 
ON public.pipelines 
FOR ALL 
USING (is_workspace_member(workspace_id, 'admin'::system_profile));

-- Políticas RLS para pipeline_columns
CREATE POLICY "Users can view pipeline columns in their workspace" 
ON public.pipeline_columns 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.pipelines p 
  WHERE p.id = pipeline_columns.pipeline_id 
  AND is_workspace_member(p.workspace_id, 'user'::system_profile)
));

CREATE POLICY "Admins can manage pipeline columns in their workspace" 
ON public.pipeline_columns 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.pipelines p 
  WHERE p.id = pipeline_columns.pipeline_id 
  AND is_workspace_member(p.workspace_id, 'admin'::system_profile)
));

-- Políticas RLS para pipeline_cards
CREATE POLICY "Users can view pipeline cards in their workspace" 
ON public.pipeline_cards 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.pipelines p 
  WHERE p.id = pipeline_cards.pipeline_id 
  AND is_workspace_member(p.workspace_id, 'user'::system_profile)
));

CREATE POLICY "Admins can manage pipeline cards in their workspace" 
ON public.pipeline_cards 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.pipelines p 
  WHERE p.id = pipeline_cards.pipeline_id 
  AND is_workspace_member(p.workspace_id, 'admin'::system_profile)
));

-- Trigger para updated_at
CREATE TRIGGER update_pipelines_updated_at
  BEFORE UPDATE ON public.pipelines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pipeline_cards_updated_at
  BEFORE UPDATE ON public.pipeline_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_pipelines_workspace_id ON public.pipelines(workspace_id);
CREATE INDEX idx_pipeline_columns_pipeline_id ON public.pipeline_columns(pipeline_id);
CREATE INDEX idx_pipeline_cards_pipeline_id ON public.pipeline_cards(pipeline_id);
CREATE INDEX idx_pipeline_cards_column_id ON public.pipeline_cards(column_id);
CREATE INDEX idx_pipeline_cards_conversation_id ON public.pipeline_cards(conversation_id);
CREATE INDEX idx_pipeline_cards_contact_id ON public.pipeline_cards(contact_id);