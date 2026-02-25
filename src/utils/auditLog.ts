import { supabase } from '@/integrations/supabase/client';

export type AuditAction = 
  | 'agent.created' | 'agent.updated' | 'agent.deleted'
  | 'user.created' | 'user.updated' | 'user.deleted'
  | 'connection.created' | 'connection.deleted' | 'connection.connected' | 'connection.disconnected'
  | 'queue.created' | 'queue.updated' | 'queue.deleted'
  | 'pipeline.created' | 'pipeline.updated' | 'pipeline.deleted'
  | 'contact.created' | 'contact.updated' | 'contact.deleted'
  | 'automation.created' | 'automation.updated' | 'automation.deleted'
  | 'tag.created' | 'tag.updated' | 'tag.deleted'
  | 'product.created' | 'product.updated' | 'product.deleted'
  | 'quick_message.created' | 'quick_message.updated' | 'quick_message.deleted'
  | 'quick_audio.created' | 'quick_audio.deleted'
  | 'quick_media.created' | 'quick_media.deleted'
  | 'quick_document.created' | 'quick_document.deleted'
  | 'quick_funnel.created' | 'quick_funnel.updated' | 'quick_funnel.deleted'
  | 'activity.created' | 'activity.updated' | 'activity.deleted';

export type AuditEntityType = 
  | 'ai_agent' | 'user' | 'connection' | 'queue' | 'pipeline' | 'contact' | 'automation'
  | 'tag' | 'product' | 'quick_message' | 'quick_audio' | 'quick_media' | 'quick_document' | 'quick_funnel'
  | 'activity';

interface AuditLogParams {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityName: string;
  workspaceId?: string | null;
  oldData?: any;
  newData?: any;
  metadata?: any;
}

/**
 * Obtém o usuário atual do localStorage
 */
function getCurrentUser(): { id: string; email?: string } | null {
  try {
    const savedUser = localStorage.getItem('currentUser');
    if (!savedUser) return null;
    return JSON.parse(savedUser);
  } catch {
    return null;
  }
}

/**
 * Registra um log de auditoria com o usuário atual
 * Deve ser chamado após operações de criação, atualização ou exclusão
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    const user = getCurrentUser();
    
    console.log('[Audit] Iniciando registro de log:', {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      entityName: params.entityName,
      workspaceId: params.workspaceId,
      userId: user?.id
    });

    // Validar parâmetros obrigatórios
    const entityId = String(params.entityId || '').trim();
    const entityName = String(params.entityName || '').trim();
    const action = String(params.action || '').trim();
    const entityType = String(params.entityType || '').trim();

    if (!entityId || !action || !entityType) {
      console.warn('[Audit] Parâmetros obrigatórios faltando:', { entityId, action, entityType });
      return;
    }

    const rpcParams = {
      p_user_id: user?.id || null,
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_entity_name: entityName || 'N/A',
      p_workspace_id: params.workspaceId || null,
      p_old_data: params.oldData ? JSON.stringify(params.oldData) : null,
      p_new_data: params.newData ? JSON.stringify(params.newData) : null,
      p_metadata: params.metadata ? JSON.stringify(params.metadata) : '{}',
      p_source: 'frontend',
    };

    console.log('[Audit] Chamando RPC com params:', rpcParams);

    const { data, error } = await supabase.rpc('register_audit_log_with_user' as any, rpcParams);

    if (error) {
      console.error('[Audit] Erro ao registrar log:', error);
    } else {
      console.log('[Audit] Log registrado com sucesso, ID:', data);
    }
  } catch (error) {
    console.error('[Audit] Exceção ao registrar log:', error);
  }
}

/**
 * Helper para criar log de criação
 */
export async function logCreate(
  entityType: AuditEntityType,
  entityId: string,
  entityName: string,
  newData: any,
  workspaceId?: string | null
): Promise<void> {
  const actionMap: Record<AuditEntityType, AuditAction> = {
    'ai_agent': 'agent.created',
    'user': 'user.created',
    'connection': 'connection.created',
    'queue': 'queue.created',
    'pipeline': 'pipeline.created',
    'contact': 'contact.created',
    'automation': 'automation.created',
    'tag': 'tag.created',
    'product': 'product.created',
    'quick_message': 'quick_message.created',
    'quick_audio': 'quick_audio.created',
    'quick_media': 'quick_media.created',
    'quick_document': 'quick_document.created',
    'quick_funnel': 'quick_funnel.created',
    'activity': 'activity.created',
  };

  await logAudit({
    action: actionMap[entityType],
    entityType,
    entityId,
    entityName,
    workspaceId,
    newData,
  });
}

/**
 * Helper para criar log de atualização
 */
export async function logUpdate(
  entityType: AuditEntityType,
  entityId: string,
  entityName: string,
  oldData: any,
  newData: any,
  workspaceId?: string | null
): Promise<void> {
  const actionMap: Record<AuditEntityType, AuditAction> = {
    'ai_agent': 'agent.updated',
    'user': 'user.updated',
    'connection': 'connection.connected', // ou disconnected dependendo do caso
    'queue': 'queue.updated',
    'pipeline': 'pipeline.updated',
    'contact': 'contact.updated',
    'automation': 'automation.updated',
    'tag': 'tag.updated',
    'product': 'product.updated',
    'quick_message': 'quick_message.updated',
    'quick_audio': 'quick_audio.created', // áudios não têm update
    'quick_media': 'quick_media.created', // mídias não têm update
    'quick_document': 'quick_document.created', // docs não têm update
    'quick_funnel': 'quick_funnel.updated',
    'activity': 'activity.updated',
  };

  await logAudit({
    action: actionMap[entityType],
    entityType,
    entityId,
    entityName,
    workspaceId,
    oldData,
    newData,
  });
}

/**
 * Helper para criar log de exclusão
 */
export async function logDelete(
  entityType: AuditEntityType,
  entityId: string,
  entityName: string,
  oldData: any,
  workspaceId?: string | null
): Promise<void> {
  const actionMap: Record<AuditEntityType, AuditAction> = {
    'ai_agent': 'agent.deleted',
    'user': 'user.deleted',
    'connection': 'connection.deleted',
    'queue': 'queue.deleted',
    'pipeline': 'pipeline.deleted',
    'contact': 'contact.deleted',
    'automation': 'automation.deleted',
    'tag': 'tag.deleted',
    'product': 'product.deleted',
    'quick_message': 'quick_message.deleted',
    'quick_audio': 'quick_audio.deleted',
    'quick_media': 'quick_media.deleted',
    'quick_document': 'quick_document.deleted',
    'quick_funnel': 'quick_funnel.deleted',
    'activity': 'activity.deleted',
  };

  await logAudit({
    action: actionMap[entityType],
    entityType,
    entityId,
    entityName,
    workspaceId,
    oldData,
  });
}
