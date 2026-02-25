-- Criar função para definir o contexto do usuário atual
CREATE OR REPLACE FUNCTION public.set_current_user_context(user_id text, user_email text DEFAULT NULL)
RETURNS void AS $$
BEGIN
    -- Define o contexto do usuário atual na sessão
    PERFORM set_config('app.current_user_id', user_id, false);
    IF user_email IS NOT NULL THEN
        PERFORM set_config('app.current_user_email', user_email, false);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Atualizar a função current_system_user_id para usar o contexto definido
CREATE OR REPLACE FUNCTION public.current_system_user_id()
RETURNS UUID AS $$
BEGIN
    -- Primeiro tenta obter do contexto da aplicação
    RETURN COALESCE(
        current_setting('app.current_user_id', true)::uuid,
        -- Fallback para JWT se disponível
        (current_setting('request.jwt.claims', true)::json->>'x-system-user-id')::uuid
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;