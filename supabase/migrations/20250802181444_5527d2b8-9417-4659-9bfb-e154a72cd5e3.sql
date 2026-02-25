-- Remover função trigger_ai_response problemática que usa net.http_post()
DROP FUNCTION IF EXISTS public.trigger_ai_response();

-- Remover trigger se existir
DROP TRIGGER IF EXISTS trigger_ai_response_on_messages ON public.messages;