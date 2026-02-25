-- Remover políticas existentes da tabela queues
DROP POLICY IF EXISTS "Admins can manage queues in their workspace" ON public.queues;
DROP POLICY IF EXISTS "Users can create queues in their workspace" ON public.queues;
DROP POLICY IF EXISTS "Users can update queues in their workspace" ON public.queues;
DROP POLICY IF EXISTS "Users can view queues in their workspace" ON public.queues;

-- Criar política simples e permissiva para todas as operações
CREATE POLICY "Allow all operations on queues"
ON public.queues
FOR ALL
USING (true)
WITH CHECK (true);