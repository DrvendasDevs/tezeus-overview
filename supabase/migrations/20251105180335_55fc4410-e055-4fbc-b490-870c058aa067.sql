-- Tabela para configurações de alertas de providers
CREATE TABLE IF NOT EXISTS public.whatsapp_provider_alert_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('evolution', 'zapi', 'all')),
  error_threshold_percent INTEGER NOT NULL DEFAULT 30 CHECK (error_threshold_percent > 0 AND error_threshold_percent <= 100),
  time_window_minutes INTEGER NOT NULL DEFAULT 60 CHECK (time_window_minutes > 0),
  email_notifications_enabled BOOLEAN NOT NULL DEFAULT false,
  toast_notifications_enabled BOOLEAN NOT NULL DEFAULT true,
  notification_emails TEXT[], -- Array de emails para notificar
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, provider)
);

-- Tabela para histórico de alertas disparados
CREATE TABLE IF NOT EXISTS public.whatsapp_provider_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  provider TEXT NOT NULL,
  error_rate DECIMAL(5,2) NOT NULL,
  threshold_percent INTEGER NOT NULL,
  total_messages INTEGER NOT NULL,
  error_count INTEGER NOT NULL,
  time_window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  time_window_end TIMESTAMP WITH TIME ZONE NOT NULL,
  notified_via TEXT[], -- ['email', 'toast', 'realtime']
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.whatsapp_provider_alert_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_provider_alerts ENABLE ROW LEVEL SECURITY;

-- Policies para alert_config
CREATE POLICY "Users can view their workspace alert configs"
ON public.whatsapp_provider_alert_config
FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = current_system_user_id()
  )
);

CREATE POLICY "Users can insert their workspace alert configs"
ON public.whatsapp_provider_alert_config
FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = current_system_user_id()
  )
);

CREATE POLICY "Users can update their workspace alert configs"
ON public.whatsapp_provider_alert_config
FOR UPDATE
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = current_system_user_id()
  )
);

CREATE POLICY "Users can delete their workspace alert configs"
ON public.whatsapp_provider_alert_config
FOR DELETE
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = current_system_user_id()
  )
);

-- Policies para alerts
CREATE POLICY "Users can view their workspace alerts"
ON public.whatsapp_provider_alerts
FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = current_system_user_id()
  )
);

CREATE POLICY "Service role can insert alerts"
ON public.whatsapp_provider_alerts
FOR INSERT
WITH CHECK (true);

-- Indexes para performance
CREATE INDEX idx_provider_alert_config_workspace ON public.whatsapp_provider_alert_config(workspace_id);
CREATE INDEX idx_provider_alerts_workspace ON public.whatsapp_provider_alerts(workspace_id);
CREATE INDEX idx_provider_alerts_created_at ON public.whatsapp_provider_alerts(created_at DESC);

-- Function para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_provider_alert_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para updated_at
CREATE TRIGGER update_provider_alert_config_updated_at
BEFORE UPDATE ON public.whatsapp_provider_alert_config
FOR EACH ROW
EXECUTE FUNCTION public.update_provider_alert_config_updated_at();

-- Criar canal realtime para alertas
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_provider_alerts;