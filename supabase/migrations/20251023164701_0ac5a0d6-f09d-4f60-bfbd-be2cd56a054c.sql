-- ✅ CORREÇÃO CRÍTICA: Adicionar tabelas à publicação Realtime
-- Não usar DROP PUBLICATION (isso é destrutivo e remove todas as tabelas)
-- Usar ALTER PUBLICATION ADD TABLE para adicionar incrementalmente

-- 1. Garantir que messages está na publicação
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    RAISE NOTICE 'Adicionada tabela messages à publicação supabase_realtime';
  ELSE
    RAISE NOTICE 'Tabela messages já está na publicação';
  END IF;
END $$;

-- 2. Garantir que conversations está na publicação
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    RAISE NOTICE 'Adicionada tabela conversations à publicação supabase_realtime';
  ELSE
    RAISE NOTICE 'Tabela conversations já está na publicação';
  END IF;
END $$;

-- 3. Garantir que contacts está na publicação
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'contacts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
    RAISE NOTICE 'Adicionada tabela contacts à publicação supabase_realtime';
  ELSE
    RAISE NOTICE 'Tabela contacts já está na publicação';
  END IF;
END $$;

-- 4. Garantir que notifications está na publicação
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    RAISE NOTICE 'Adicionada tabela notifications à publicação supabase_realtime';
  ELSE
    RAISE NOTICE 'Tabela notifications já está na publicação';
  END IF;
END $$;

-- 5. Validar REPLICA IDENTITY FULL nas tabelas críticas
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;
ALTER TABLE public.contacts REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- 6. Verificar status final
DO $$
DECLARE
  tabelas_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO tabelas_count
  FROM pg_publication_tables 
  WHERE pubname = 'supabase_realtime';
  
  RAISE NOTICE 'Total de tabelas na publicação supabase_realtime: %', tabelas_count;
END $$;