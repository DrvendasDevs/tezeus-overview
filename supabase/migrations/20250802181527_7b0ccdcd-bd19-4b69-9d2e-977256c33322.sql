-- Remover trigger primeiro, depois a função
DROP TRIGGER IF EXISTS trigger_ai_response_on_message ON public.messages;
DROP FUNCTION IF EXISTS public.trigger_ai_response() CASCADE;