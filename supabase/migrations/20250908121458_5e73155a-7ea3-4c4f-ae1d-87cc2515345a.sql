-- Criar tabela para gerenciar cards do dashboard
CREATE TABLE public.dashboard_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('message', 'system', 'achievement', 'task')),
  action_url TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_position INTEGER NOT NULL DEFAULT 0,
  workspace_id UUID NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.dashboard_cards ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "dashboard_cards_select" ON public.dashboard_cards
FOR SELECT USING (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "dashboard_cards_insert" ON public.dashboard_cards
FOR INSERT WITH CHECK (is_workspace_member(workspace_id, 'admin'::system_profile));

CREATE POLICY "dashboard_cards_update" ON public.dashboard_cards
FOR UPDATE USING (is_workspace_member(workspace_id, 'admin'::system_profile));

CREATE POLICY "dashboard_cards_delete" ON public.dashboard_cards
FOR DELETE USING (is_workspace_member(workspace_id, 'admin'::system_profile));

-- Índices para performance
CREATE INDEX idx_dashboard_cards_workspace_id ON public.dashboard_cards(workspace_id);
CREATE INDEX idx_dashboard_cards_active_order ON public.dashboard_cards(workspace_id, is_active, order_position);

-- Trigger para updated_at
CREATE TRIGGER update_dashboard_cards_updated_at
  BEFORE UPDATE ON public.dashboard_cards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir dados de exemplo para o workspace padrão
INSERT INTO public.dashboard_cards (title, description, type, action_url, image_url, order_position, workspace_id) VALUES
('Nova conversa iniciada', 'Cliente João Silva iniciou uma conversa sobre produtos', 'message', '/conversas', 'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=400&h=200&fit=crop&crop=center', 1, '00000000-0000-0000-0000-000000000000'),
('Meta de vendas atingida', 'Parabéns! Você atingiu 80% da meta mensal', 'achievement', NULL, 'https://images.unsplash.com/photo-1492112007959-c35ae067c37b?w=400&h=200&fit=crop&crop=center', 2, '00000000-0000-0000-0000-000000000000'),
('Sistema atualizado', 'Nova versão 2.1 com melhorias de performance', 'system', NULL, 'https://images.unsplash.com/photo-1518709268805-4e9042af2176?w=400&h=200&fit=crop&crop=center', 3, '00000000-0000-0000-0000-000000000000'),
('Reunião agendada', 'Reunião com equipe comercial às 15:00', 'task', '/recursos-tarefas', 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=400&h=200&fit=crop&crop=center', 4, '00000000-0000-0000-0000-000000000000');