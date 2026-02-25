-- SOLUÇÃO DEFINITIVA: Remover todas as políticas RLS da tabela dashboard_cards
-- e desabilitar RLS para permitir funcionamento completo

-- Primeiro, remover todas as políticas existentes
DROP POLICY IF EXISTS "dashboard_cards_select_global_and_workspace" ON public.dashboard_cards;
DROP POLICY IF EXISTS "dashboard_cards_insert_authenticated" ON public.dashboard_cards;
DROP POLICY IF EXISTS "dashboard_cards_update_authenticated" ON public.dashboard_cards;
DROP POLICY IF EXISTS "dashboard_cards_delete_authenticated" ON public.dashboard_cards;

-- Desabilitar RLS na tabela dashboard_cards
ALTER TABLE public.dashboard_cards DISABLE ROW LEVEL SECURITY;

-- Verificar se funcionou
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'dashboard_cards';