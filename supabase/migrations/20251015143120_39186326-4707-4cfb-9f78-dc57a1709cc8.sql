-- Remover todas as políticas RLS da tabela pipeline_cards
DROP POLICY IF EXISTS "Masters and admins can manage pipeline cards in their workspace" ON pipeline_cards;
DROP POLICY IF EXISTS "Users can create pipeline cards based on responsibility_v2" ON pipeline_cards;
DROP POLICY IF EXISTS "Users can update pipeline cards based on responsibility_v2" ON pipeline_cards;
DROP POLICY IF EXISTS "Users can view all pipeline cards in their workspace" ON pipeline_cards;

-- Desabilitar RLS completamente na tabela pipeline_cards
ALTER TABLE pipeline_cards DISABLE ROW LEVEL SECURITY;