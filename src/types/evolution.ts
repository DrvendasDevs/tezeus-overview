export interface Connection {
  id: string;
  instance_name: string;
  status: 'creating' | 'qr' | 'connecting' | 'connected' | 'disconnected' | 'error';
  qr_code?: string;
  phone_number?: string;
  history_recovery: 'none' | 'week' | 'month' | 'quarter';
  history_days?: number;
  history_sync_status?: 'pending' | 'syncing' | 'completed' | 'failed';
  history_sync_started_at?: string;
  history_messages_synced?: number;
  created_at: string;
  last_activity_at?: string;
  workspace_id: string;
  auto_create_crm_card?: boolean;
  default_pipeline_id?: string;
  default_column_id?: string;
  default_column_name?: string;
  queue_id?: string;
  is_default?: boolean;
  provider_id?: string;
  provider?: {
    id: string;
    provider: 'evolution' | 'zapi';
    evolution_url?: string;
    zapi_url?: string;
  };
  metadata?: {
    remote_id?: string;
    device?: string;
    [key: string]: any;
  };
}

export interface ConnectionsQuota {
  used: number;
  limit: number;
}

export interface CreateConnectionRequest {
  instanceName: string;
  historyRecovery: 'none' | 'week' | 'month' | 'quarter';
  workspaceId: string;
  autoCreateCrmCard?: boolean;
  defaultPipelineId?: string;
  defaultColumnId?: string;
  defaultColumnName?: string;
  queueId?: string;
  phoneNumber?: string;
}

export interface ProvisionerLog {
  id: string;
  connection_id?: string;
  correlation_id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  event_type: string;
  created_at: string;
  metadata?: {
    [key: string]: any;
  };
}

export interface TestResult {
  test: string;
  passed: boolean;
  message?: string;
}

export interface ConnectionTestResponse {
  success: boolean;
  tests: TestResult[];
  summary: {
    passed: number;
    total: number;
  };
  timestamp: string;
}

export const CONNECTION_STATUS_MAP = {
  creating: { label: 'Criando', variant: 'secondary' as const, color: 'hsl(var(--muted-foreground))' },
  qr: { label: 'QR Code', variant: 'outline' as const, color: 'hsl(var(--warning))' },
  connecting: { label: 'Conectando', variant: 'outline' as const, color: 'hsl(var(--primary))' },
  connected: { label: 'Conectado', variant: 'default' as const, color: 'hsl(var(--success))' },
  disconnected: { label: 'Desconectado', variant: 'destructive' as const, color: 'hsl(var(--destructive))' },
  error: { label: 'Erro', variant: 'destructive' as const, color: 'hsl(var(--destructive))' },
} as const;

export const HISTORY_RECOVERY_MAP = {
  none: 'Nenhuma',
  week: 'Uma semana',
  month: 'Um mês',
  quarter: 'Três meses',
} as const;