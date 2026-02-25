export type WhatsAppProviderType = 'evolution' | 'zapi';

export interface WhatsAppProvider {
  id: string;
  workspace_id: string;
  provider: WhatsAppProviderType;
  is_active: boolean;
  evolution_url?: string;
  evolution_token?: string;
  zapi_url?: string;
  zapi_token?: string;
  zapi_client_token?: string;
  n8n_webhook_url?: string;
  n8n_status_webhook_url?: string;
  enable_fallback: boolean;
  created_at: string;
  updated_at: string;
}

export interface ConnectionWithProvider {
  id: string;
  instance_name: string;
  status: string;
  phone_number?: string;
  provider_id?: string;
  provider?: WhatsAppProvider;
}
