
-- 1) Garantir org padrão (id usado no frontend e funções)
INSERT INTO public.orgs (id, name)
VALUES ('00000000-0000-0000-0000-000000000000', 'Default Organization')
ON CONFLICT (id) DO NOTHING;

-- 2) Índice único para suportar o onConflict em channels (org_id, instance)
CREATE UNIQUE INDEX IF NOT EXISTS channels_org_instance_uidx
ON public.channels (org_id, instance);

-- 3) Índice único para suportar o onConflict em evolution_instance_tokens (org_id, instance_name)
CREATE UNIQUE INDEX IF NOT EXISTS evolution_instance_tokens_org_instance_uidx
ON public.evolution_instance_tokens (org_id, instance_name);
