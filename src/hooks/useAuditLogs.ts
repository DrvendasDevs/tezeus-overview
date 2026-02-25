import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AuditLog {
  id: string;
  workspace_id: string | null;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  old_data: any;
  new_data: any;
  metadata: any;
  ip_address: string | null;
  user_agent: string | null;
  source: 'frontend' | 'trigger' | 'legacy' | null;
  created_at: string;
  // Joined data
  workspace?: {
    name: string;
  } | null;
}

export interface AuditLogsFilters {
  workspaceId?: string | null;
  userId?: string | null;
  action?: string | null;
  entityType?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  search?: string | null;
}

export const useAuditLogs = (filters: AuditLogsFilters = {}, page: number = 1, pageSize: number = 50) => {
  return useQuery({
    queryKey: ['audit-logs', JSON.stringify(filters), page, pageSize],
    queryFn: async (): Promise<{ data: AuditLog[]; count: number }> => {
      // Usar VIEW que já tem os JOINs resolvidos
      let query = supabase
        .from('audit_logs_view' as any)
        .select('*', { count: 'exact' });

      // Aplicar filtros
      if (filters.workspaceId) {
        query = query.eq('workspace_id', filters.workspaceId);
      }

      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }

      if (filters.action) {
        query = query.eq('action', filters.action);
      }

      if (filters.entityType) {
        query = query.eq('entity_type', filters.entityType);
      }

      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      if (filters.search) {
        query = query.or(`entity_name.ilike.%${filters.search}%,user_name.ilike.%${filters.search}%`);
      }

      // Ordenação e paginação
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      query = query
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('❌ Erro ao buscar logs de auditoria:', error);
        throw error;
      }

      // Mapear os logs da VIEW para o formato esperado pelo componente
      const logs = (data || []).map((log: any) => ({
        ...log,
        workspace: log.workspace_name ? { name: log.workspace_name } : null
      }));

      return {
        data: logs as AuditLog[],
        count: count || 0
      };
    },
    staleTime: 5000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: 2,
  });
};

// Hook para buscar ações únicas (para filtro)
export const useAuditLogActions = () => {
  return useQuery({
    queryKey: ['audit-log-actions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs' as any)
        .select('action')
        .order('action');

      if (error) throw error;

      // Retornar ações únicas
      const actions = [...new Set((data || []).map((d: any) => d.action))];
      return actions as string[];
    },
    staleTime: 60000, // 1 minuto
  });
};

// Hook para buscar tipos de entidade únicos (para filtro)
export const useAuditLogEntityTypes = () => {
  return useQuery({
    queryKey: ['audit-log-entity-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs' as any)
        .select('entity_type')
        .order('entity_type');

      if (error) throw error;

      // Retornar tipos únicos
      const types = [...new Set((data || []).map((d: any) => d.entity_type))];
      return types as string[];
    },
    staleTime: 60000, // 1 minuto
  });
};

// Mapeamento de ações para labels amigáveis
export const actionLabels: Record<string, string> = {
  'agent.created': 'Agente criado',
  'agent.updated': 'Agente atualizado',
  'agent.deleted': 'Agente excluído',
  'user.created': 'Usuário criado',
  'user.updated': 'Usuário atualizado',
  'user.deleted': 'Usuário excluído',
  'user.login': 'Login realizado',
  'user.logout': 'Logout realizado',
  'connection.created': 'Conexão criada',
  'connection.deleted': 'Conexão excluída',
  'connection.connected': 'Conexão estabelecida',
  'connection.disconnected': 'Conexão desconectada',
  'connection.status_changed': 'Status da conexão alterado',
  'queue.created': 'Fila criada',
  'queue.updated': 'Fila atualizada',
  'queue.deleted': 'Fila excluída',
  'pipeline.created': 'Pipeline criado',
  'pipeline.updated': 'Pipeline atualizado',
  'pipeline.deleted': 'Pipeline excluído',
  'contact.created': 'Contato criado',
  'contact.updated': 'Contato atualizado',
  'contact.deleted': 'Contato excluído',
  'automation.created': 'Automação criada',
  'automation.updated': 'Automação atualizada',
  'automation.deleted': 'Automação excluída',
  // Tags
  'tag.created': 'Tag criada',
  'tag.updated': 'Tag atualizada',
  'tag.deleted': 'Tag excluída',
  // Produtos
  'product.created': 'Produto criado',
  'product.updated': 'Produto atualizado',
  'product.deleted': 'Produto excluído',
  // Mensagens rápidas
  'quick_message.created': 'Msg rápida criada',
  'quick_message.updated': 'Msg rápida atualizada',
  'quick_message.deleted': 'Msg rápida excluída',
  // Áudios rápidos
  'quick_audio.created': 'Áudio criado',
  'quick_audio.deleted': 'Áudio excluído',
  // Mídias rápidas
  'quick_media.created': 'Mídia criada',
  'quick_media.deleted': 'Mídia excluída',
  // Documentos rápidos
  'quick_document.created': 'Documento criado',
  'quick_document.deleted': 'Documento excluído',
  // Funis rápidos
  'quick_funnel.created': 'Funil criado',
  'quick_funnel.updated': 'Funil atualizado',
  'quick_funnel.deleted': 'Funil excluído',
};

// Mapeamento de tipos de entidade para labels
export const entityTypeLabels: Record<string, string> = {
  'ai_agent': 'Agente IA',
  'user': 'Usuário',
  'connection': 'Conexão WhatsApp',
  'queue': 'Fila',
  'pipeline': 'Pipeline',
  'contact': 'Contato',
  'automation': 'Automação',
  'workspace': 'Workspace',
  'tag': 'Tag/Etiqueta',
  'product': 'Produto',
  'quick_message': 'Msg Rápida',
  'quick_audio': 'Áudio Rápido',
  'quick_media': 'Mídia Rápida',
  'quick_document': 'Documento',
  'quick_funnel': 'Funil Rápido',
};

// Cores para cada tipo de ação
export const actionColors: Record<string, string> = {
  'created': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'updated': 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  'deleted': 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  'connected': 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  'disconnected': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  'login': 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  'logout': 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

export const getActionColor = (action: string): string => {
  const actionType = action.split('.')[1];
  return actionColors[actionType] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
};
