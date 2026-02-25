-- Função para limpar todas as conversas e mensagens
CREATE OR REPLACE FUNCTION public.clear_all_conversations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  -- Deletar todas as mensagens primeiro (devido à FK)
  DELETE FROM public.messages;
  
  -- Deletar todas as conversas
  DELETE FROM public.conversations;
  
  -- Resetar contadores se necessário
  -- Os contatos são preservados
END;
$function$;