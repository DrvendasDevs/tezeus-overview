// Evolution Webhook V2 - Safe connection handling
// Force redeploy: 2025-10-15 - Forcing deployment with cleaned dbMessageId removal
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing required environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-secret',
};

// ✅ DEDUP LOCAL - Prevenir processamento duplicado de eventos
const recentEvents = new Set<string>();

function checkDedup(key: string): boolean {
  if (recentEvents.has(key)) return true;
  recentEvents.add(key);
  setTimeout(() => recentEvents.delete(key), 10000); // TTL de 10s
  return false;
}

function generateRequestId(): string {
  return `evo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizePhoneNumber(phone: string): string {
  // Remove todos os caracteres não-numéricos
  let cleaned = phone.replace(/\D/g, '');
  
  // Remove sufixos comuns do Evolution API (62, 63, etc)
  // Esses são adicionados incorretamente pelo WhatsApp em alguns casos
  if (cleaned.length > 13 && cleaned.endsWith('62')) {
    const original = cleaned;
    cleaned = cleaned.slice(0, -2);
    console.log(`⚠️ [SANITIZE] Truncated phone number: "${phone}" -> original_digits="${original}" (${original.length} chars) -> final="${cleaned}" (${cleaned.length} chars)`);
  }
  
  return cleaned;
}

function extractPhoneFromRemoteJid(remoteJid: string): string {
  // Handle different WhatsApp remoteJid formats:
  // @s.whatsapp.net (normal WhatsApp contacts)
  // @lid (LinkedIn imported contacts or other sources)
  // @g.us (group chats)
  // @broadcast (broadcast lists)
  console.log(`📱 Extracting phone from remoteJid: ${remoteJid}`);
  
  // Remove any WhatsApp suffix using regex
  const phoneNumber = remoteJid.replace(/@(s\.whatsapp\.net|lid|g\.us|broadcast|c\.us)$/, '');
  const sanitized = sanitizePhoneNumber(phoneNumber);
  
  console.log(`📱 Extracted phone: ${phoneNumber} -> sanitized: ${sanitized}`);
  return sanitized;
}

// Helper function to get or create conversation
async function getOrCreateConversation(
  supabase: any,
  phoneNumber: string,
  contactId: string,
  connectionId: string,
  workspaceId: string,
  instanceName: string,
  connectionPhone?: string | null
) {
  // ✅ Buscar conversa ativa existente por contact_id + connection_id
  // Isso garante que ao mudar connection_id, a conversa seja vinculada corretamente
  const { data: existing } = await supabase
    .from('conversations')
    .select('id, contact_id, assigned_user_id, connection_id, connection_phone')
    .eq('contact_id', contactId)
    .eq('connection_id', connectionId)
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let matchedConversation = existing;

  if (existing && connectionPhone && existing.connection_phone && existing.connection_phone !== connectionPhone) {
    console.log(`↪️ [ROUTING] Connection phone changed (old: ${existing.connection_phone}, new: ${connectionPhone}). Creating a fresh conversation.`);
    matchedConversation = null;
  } else if (existing && connectionPhone && !existing.connection_phone) {
    console.log(`🧼 [ROUTING] Backfilling connection phone snapshot for conversation ${existing.id}`);
    await supabase
      .from('conversations')
      .update({ connection_phone: connectionPhone })
      .eq('id', existing.id);
    
    matchedConversation = { ...existing, connection_phone: connectionPhone };
  }

  if (matchedConversation) {
    console.log(`✅ [ROUTING] Found conversation ${matchedConversation.id} for contact ${contactId} on connection ${connectionId}`);
    
    // 🤖 Verificar e ativar agente IA se necessário
    const { data: existingWithQueue } = await supabase
      .from('conversations')
      .select('id, queue_id, agente_ativo')
      .eq('id', matchedConversation.id)
      .single();
    
    if (existingWithQueue?.queue_id) {
      const { data: queue } = await supabase
        .from('queues')
        .select('ai_agent_id')
        .eq('id', existingWithQueue.queue_id)
        .single();
      
      if (queue?.ai_agent_id && !existingWithQueue.agente_ativo) {
        console.log(`🤖 [${instanceName}] Ativando agente IA para conversa ${matchedConversation.id}`);
        
        await supabase
          .from('conversations')
          .update({ 
            agente_ativo: true,
            agent_active_id: queue.ai_agent_id  // ✅ SALVAR ID DO AGENTE
          })
          .eq('id', matchedConversation.id);
        
        matchedConversation.agente_ativo = true;
        console.log(`✅ [${instanceName}] Agente IA ativado automaticamente (ID: ${queue.ai_agent_id})`);
      }
    }
    
    return matchedConversation;
  }
  
  // Criar nova conversa se não existir
  console.log(`🆕 [ROUTING] Creating new conversation for contact ${contactId} on connection ${connectionId}`);
  const { data: newConv, error } = await supabase
    .from('conversations')
    .insert({
      contact_phone: phoneNumber,
      contact_id: contactId,
      connection_id: connectionId,
      workspace_id: workspaceId,
      instance_name: instanceName,
      connection_phone: connectionPhone || null,
      status: 'active',
      last_message_at: new Date().toISOString()
    })
    .select('id, contact_id, assigned_user_id, connection_id, connection_phone')
    .single();
  
  if (error) {
    console.error('❌ Erro ao criar conversa:', error);
    return null;
  }
  
  console.log(`✅ New conversation created: ${newConv.id}`);
  
  // 🎯 DISTRIBUIÇÃO AUTOMÁTICA: Se é uma conversa NOVA, distribuir para fila
  if (newConv && connectionId) {
    console.log(`🎯 Nova conversa criada - iniciando distribuição automática`);
    
    try {
      const { data: distResult, error: distError } = await supabase.functions.invoke(
        'assign-conversation-to-queue',
        {
          body: {
            conversation_id: newConv.id,
            queue_id: null  // Auto-detectar da conexão
          }
        }
      );
      
      if (distError) {
        console.error(`❌ Erro ao distribuir automaticamente:`, distError);
      } else {
        console.log(`✅ Distribuição automática concluída:`, distResult);
      }
    } catch (distException) {
      console.error(`❌ Exceção ao distribuir:`, distException);
    }
  }
  
  return newConv;
}

serve(async (req) => {
  const requestId = generateRequestId();
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      code: 'METHOD_NOT_ALLOWED',
      message: 'Only POST method is allowed',
      requestId
    }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // 🔐 SECURITY: Log incoming requests for debugging
  const secretHeader = req.headers.get('X-Secret');
  const userAgent = req.headers.get('User-Agent');
  const authorization = req.headers.get('Authorization');
  
  console.log(`🔍 [${requestId}] Headers received:`, {
    'X-Secret': secretHeader,
    'User-Agent': userAgent,
    'Authorization': authorization ? '[REDACTED]' : null,
    'Content-Type': req.headers.get('Content-Type')
  });
  
  // Evolution API calls typically don't include X-Secret, so we'll allow them
  // but log for security monitoring
  if (!secretHeader && !authorization) {
    console.log(`⚠️ [${requestId}] Request without authentication headers - treating as Evolution API call`);
  }
  
  console.log(`✅ [${requestId}] Authorization verified - request from Evolution API`);

  try {
    const payload = await req.json();
    console.log(`📨 [${requestId}] Evolution webhook received:`, JSON.stringify(payload, null, 2));

    // Extract instance name from payload
    const instanceName = payload.instance || payload.instanceName;
    
    // ✅ FASE 1.2: Buscar dados da conexão UMA ÚNICA VEZ (consolidação de queries)
    let connectionData = null;
    let workspaceId = null;
    let webhookUrl = null;
    let webhookSecret = null;
    
    if (instanceName) {
      console.log(`🔍 [${requestId}] Fetching connection data for instance: ${instanceName}`);
      const { data: conn } = await supabase
        .from('connections')
        .select(`
          id,
          workspace_id,
          phone_number,
          history_days,
          history_recovery,
          history_sync_status,
          history_sync_started_at,
          auto_create_crm_card,
          default_pipeline_id,
          default_column_id,
          default_column_name,
          queue_id,
          created_at
        `)
        .eq('instance_name', instanceName)
        .single();
      
      if (conn) {
        connectionData = conn;
        workspaceId = conn.workspace_id;
        
        // Get webhook settings for this workspace
        const { data: webhookSettings } = await supabase
          .from('workspace_webhook_settings')
          .select('webhook_url, webhook_secret')
          .eq('workspace_id', workspaceId)
          .single();

        if (webhookSettings) {
          webhookUrl = webhookSettings.webhook_url;
          webhookSecret = webhookSettings.webhook_secret;
        }
        
        // Fallback to environment variables if no workspace webhook configured
        if (!webhookUrl) {
          webhookUrl = Deno.env.get('N8N_INBOUND_WEBHOOK_URL');
          webhookSecret = Deno.env.get('N8N_WEBHOOK_TOKEN');
        }
        
        console.log(`🔧 [${requestId}] Connection data loaded:`, {
          workspace_id: workspaceId,
          webhook_url: webhookUrl ? webhookUrl.substring(0, 50) + '...' : 'NOT FOUND',
          has_secret: !!webhookSecret,
          auto_create_crm_card: conn.auto_create_crm_card,
          default_pipeline_id: conn.default_pipeline_id,
          default_column_id: conn.default_column_id,
          default_column_name: conn.default_column_name,
          queue_id: conn.queue_id
        });
      } else {
        console.warn(`⚠️ [${requestId}] Connection not found for instance: ${instanceName}`);
      }
    }
    
    // ✅ FASE 1.1: Normalizar evento para processamento consistente
    const EVENT = String(payload.event || '').toUpperCase().replace(/\./g, '_');
    console.log(`📊 [${requestId}] Instance: ${instanceName}, Event: "${payload.event}" → normalized: "${EVENT}"`);
    
    // 🔍 LOG COMPLETO DO PAYLOAD PARA DIAGNÓSTICO DE EVENTOS DE LEITURA
    console.log(`🔍 [${requestId}] FULL PAYLOAD FOR DEBUGGING:`);
    console.log(JSON.stringify({
      event: payload.event,
      instance: payload.instance,
      data: payload.data,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    // ✅ IGNORAR CONNECTION_UPDATE: Não processar eventos de conexão para evitar spam
    if (EVENT === 'CONNECTION_UPDATE') {
      console.log(`⏭️ [${requestId}] CONNECTION_UPDATE ignorado (evento desabilitado)`);
      return new Response(JSON.stringify({
        code: 'EVENT_IGNORED',
        message: 'CONNECTION_UPDATE events are disabled',
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // ✅ DEDUP: Verificar se já processamos esse evento recentemente
    const dedupKey = `${EVENT}:${payload.data?.keyId || payload.data?.messageId || payload.data?.key?.id || Date.now()}`;
    
    if (checkDedup(dedupKey)) {
      console.log(`⏭️ [${requestId}] Event duplicado ignorado: ${dedupKey}`);
      return new Response(JSON.stringify({
        code: 'DUPLICATE_EVENT',
        message: 'Event already processed recently',
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    let processedData = null;
    
    // ✅ FASE 1.1: HANDLE MESSAGE ACKNOWLEDGMENT (read receipts) - CONSOLIDADO
    if (EVENT === 'MESSAGES_UPDATE' && (payload.data?.ack !== undefined || payload.data?.status)) {
      console.log(`📬 [${requestId}] Processing message update acknowledgment: ack=${payload.data.ack}, status=${payload.data.status}`);
      
      const messageKeyId = payload.data.keyId; // 40 chars
      const messageId = payload.data.messageId;
      const status = payload.data.status;
      
      console.log(`🔑 [${requestId}] Update event IDs:`);
      console.log(`   - keyId (40 chars): "${messageKeyId}"`);
      console.log(`   - messageId: "${messageId}"`);
      console.log(`   - status: "${status}"`);
      
      // Obter ack level do campo ack (numérico) ou mapear do campo status (string)
      let ackLevel = payload.data.ack;
      
      if (ackLevel === undefined && status) {
        console.log(`🔄 [${requestId}] Mapping status "${status}" to ack level`);
        
        switch (status) {
          case 'PENDING':
            ackLevel = 0;
            break;
          case 'SERVER_ACK':
            ackLevel = 1;
            break;
          case 'DELIVERY_ACK':
            ackLevel = 2;
            break;
          case 'READ':
            ackLevel = 3;
            break;
          case 'PLAYED':
            ackLevel = 4;
            break;
          default:
            console.warn(`⚠️ [${requestId}] Unknown status: ${status}`);
        }
      }
      
      // ✅ ESTRATÉGIA DE BUSCA INTELIGENTE CONSOLIDADA (PRIORIDADE: SHORT KEY)
      let updatedMessage = null;
      
      if (messageKeyId && status) {
        console.log(`🔍 [${requestId}] Starting intelligent message lookup`);
        
        // ✅ BUSCA IDEMPOTENTE COM OR - Buscar em uma única query
        console.log(`🔍 [${requestId}] Searching message with idempotent OR query`);
        const { data: msg, error } = await supabase
          .from('messages')
          .select('id, external_id, evolution_key_id, evolution_short_key_id, status, conversation_id, workspace_id, delivered_at, read_at')
          .or(`evolution_short_key_id.eq.${messageKeyId},evolution_key_id.eq.${messageKeyId},external_id.eq.${messageKeyId}`)
          .limit(1)
          .maybeSingle();
        
        let searchStrategy = 'idempotent_or';
        
        if (msg) {
          console.log(`✅ [${requestId}] Found message via ${searchStrategy}`);
          
          // Hierarquia de status para prevenir regressões
          const STATUS_HIERARCHY: Record<string, number> = {
            'sending': 0,
            'sent': 1,
            'delivered': 2,
            'read': 3
          };
          
          // Mapear status da Evolution para nosso schema
          const newStatus = status === 'READ' ? 'read' : 
                           status === 'DELIVERY_ACK' ? 'delivered' : 
                           status === 'SERVER_ACK' ? 'sent' : msg.status;
          
          // Verificar hierarquia para prevenir regressões
          const currentLevel = STATUS_HIERARCHY[msg.status] || 0;
          const newLevel = STATUS_HIERARCHY[newStatus] || 0;
          
          if (newLevel < currentLevel) {
            console.log(`⏭️ [${requestId}] Ignorando regressão de status: ${msg.status} (level ${currentLevel}) → ${newStatus} (level ${newLevel})`);
            // Não atualizar - manter status atual
            updatedMessage = msg;
          } else {
            const updateFields: any = { status: newStatus };
            
            // Garantir que AMBOS os evolution IDs estejam preenchidos
            if (!msg.evolution_key_id) {
              updateFields.evolution_key_id = messageKeyId;
            }
            if (!msg.evolution_short_key_id) {
              updateFields.evolution_short_key_id = messageKeyId;
            }
            
            // Atualizar timestamps conforme o status (somente se ainda não existem)
            if (status === 'DELIVERY_ACK' && !msg.delivered_at) {
              updateFields.delivered_at = new Date().toISOString();
            }
            if (status === 'READ' && !msg.read_at) {
              updateFields.read_at = new Date().toISOString();
            }
            
            // Executar update no banco
            const { error: updateError } = await supabase
              .from('messages')
              .update(updateFields)
              .eq('id', msg.id);
            
            if (updateError) {
              console.error(`❌ [${requestId}] Error updating message:`, updateError);
            } else {
              updatedMessage = { ...msg, ...updateFields };
              console.log(`✅ [${requestId}] Message updated: ${msg.status} (level ${currentLevel}) → ${newStatus} (level ${newLevel})`);
            }
          }
        } else {
          console.log(`⚠️ [${requestId}] Message NOT found: ${messageKeyId}`);
        }
      }
      
      // ✅ ENVIAR PAYLOAD LEAN PARA O N8N (UMA ÚNICA VEZ)
      if (webhookUrl && updatedMessage) {
    const updatePayload = {
      event: "MESSAGES_UPDATE",
      event_type: "update",
      workspace_id: workspaceId,
      conversation_id: updatedMessage.conversation_id,
      request_id: requestId,
      external_id: updatedMessage.external_id,
      evolution_key_id: messageKeyId,
      ack_level: ackLevel,
      status: updatedMessage.status,
      delivered_at: updatedMessage.delivered_at || null,
      read_at: updatedMessage.read_at || null,
      timestamp: new Date().toISOString(),
      
      // ✅ Campos adicionados para melhor rastreabilidade
      instance: instanceName,
      remoteJid: payload.data?.remoteJid || null,
      messageId: messageId || null
    };
        
        console.log(`🚀 [${requestId}] Sending LEAN update payload to N8N:`, updatePayload);
        
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        if (webhookSecret) {
          headers['Authorization'] = `Bearer ${webhookSecret}`;
        }
        
        try {
          const response = await fetch(webhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(updatePayload)
          });
          
          console.log(`✅ [${requestId}] N8N update webhook called successfully, status: ${response.status}`);
        } catch (error) {
          console.error(`❌ [${requestId}] Error calling N8N update webhook:`, error);
        }
      }
      
      console.log(`✅ [${requestId}] ACK processing complete`);
      
      // ✅ RETORNAR IMEDIATAMENTE após processar messages_update (não continuar para o final)
      return new Response(JSON.stringify({
        success: true,
        action: 'message_update_processed',
        message_id: updatedMessage?.id,
        workspace_id: workspaceId,
        conversation_id: updatedMessage?.conversation_id,
        requestId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 👥 PROCESS CONTACTS SYNC (CONTACTS_UPSERT / CONTACTS_UPDATE)
    if ((payload.event === 'CONTACTS_UPSERT' || payload.event === 'CONTACTS_UPDATE') && workspaceId) {
      console.log(`👥 [${requestId}] Processing contacts sync event`);
      
      const contactsData = Array.isArray(payload.data) ? payload.data : [payload.data];
      let processedContacts = 0;
      
      for (const contactData of contactsData) {
        try {
          const remoteJid = contactData.id || contactData.remoteJid;
          const phone = extractPhoneFromRemoteJid(remoteJid);
          const name = contactData.name || contactData.pushName || phone;
          const profileUrl = contactData.profilePictureUrl || contactData.profilePicUrl;
          
          console.log(`👤 [${requestId}] Upserting contact: ${phone} (${name})`);
          
          // Upsert contact (update if exists, insert if not)
          const { error: upsertError } = await supabase
            .from('contacts')
            .upsert({
              phone: phone,
              name: name,
              workspace_id: workspaceId,
              profile_image_url: profileUrl || null,
              updated_at: new Date().toISOString()
            }, {
              onConflict: 'phone,workspace_id',
              ignoreDuplicates: false
            });
          
          if (upsertError) {
            console.error(`❌ [${requestId}] Error upserting contact ${phone}:`, upsertError);
          } else {
            processedContacts++;
          }
        } catch (contactError) {
          console.error(`❌ [${requestId}] Error processing contact:`, contactError);
        }
      }
      
      console.log(`✅ [${requestId}] Processed ${processedContacts} contacts from sync`);
      
      processedData = {
        contacts_synced: processedContacts,
        workspace_id: workspaceId,
        event: payload.event
      };
    }
    
    // 📞 PROCESS CONNECTION UPDATE (phone number from QR scan)
    if (EVENT === 'CONNECTION_UPDATE' && workspaceId && instanceName) {
      console.log(`📞 [${requestId}] Processing connection update event`);
      
      // ✅ FASE 1.2: Renomear connectionData local para connectionUpdate (evitar conflito)
      const connectionUpdate = payload.data;
      const state = connectionUpdate.state; // 'open', 'close', etc
      const phoneNumber = connectionUpdate.owner || connectionUpdate.phoneNumber;
      
      // Get current connection status first to check if it was manually disconnected
      const { data: currentConnection } = await supabase
        .from('connections')
        .select('status, updated_at')
        .eq('instance_name', instanceName)
        .eq('workspace_id', workspaceId)
        .single();
      
      // Don't override 'disconnected' status if it was set recently (within last 30 seconds)
      // This prevents webhook from overriding manual disconnect actions
      const thirtySecondsAgo = new Date(Date.now() - 30000);
      const wasRecentlyDisconnected = 
        currentConnection?.status === 'disconnected' &&
        currentConnection?.updated_at &&
        new Date(currentConnection.updated_at) > thirtySecondsAgo;
      
      if (wasRecentlyDisconnected && state === 'open') {
        console.log(`⚠️ [${requestId}] Connection was manually disconnected recently, ignoring CONNECTION_UPDATE event`);
        // Only update phone number, not status
        if (phoneNumber) {
          const { error: updateError } = await supabase
            .from('connections')
            .update({
              phone_number: phoneNumber,
              // Don't update status - keep as disconnected
              updated_at: new Date().toISOString()
            })
            .eq('instance_name', instanceName)
            .eq('workspace_id', workspaceId);
          
          if (updateError) {
            console.error(`❌ [${requestId}] Error updating phone number:`, updateError);
          }
        }
      } else {
        // Normal update - update both phone and status
        if (phoneNumber) {
          console.log(`📱 [${requestId}] Updating connection phone number: ${phoneNumber}`);
          
          const { error: updateError } = await supabase
            .from('connections')
            .update({
              phone_number: phoneNumber,
              status: state === 'open' ? 'connected' : 'disconnected',
              updated_at: new Date().toISOString()
            })
            .eq('instance_name', instanceName)
            .eq('workspace_id', workspaceId);
          
          if (updateError) {
            console.error(`❌ [${requestId}] Error updating connection:`, updateError);
          } else {
            console.log(`✅ [${requestId}] Connection updated with phone: ${phoneNumber}, status: ${state === 'open' ? 'connected' : 'disconnected'}`);
          }
        } else if (state === 'close') {
          // Update status even without phone number (for disconnect events)
          console.log(`📱 [${requestId}] Updating connection status to disconnected`);
          
          const { error: updateError } = await supabase
            .from('connections')
            .update({
              status: 'disconnected',
              updated_at: new Date().toISOString()
            })
            .eq('instance_name', instanceName)
            .eq('workspace_id', workspaceId);
          
          if (updateError) {
            console.error(`❌ [${requestId}] Error updating connection status:`, updateError);
          } else {
            console.log(`✅ [${requestId}] Connection status updated to disconnected`);
          }
        }
      }

      // Se a conexão foi estabelecida, verificar/iniciar sincronização de histórico
      if (state === 'open') {
        console.log(`🔍 [${requestId}] Checking if history sync needed for ${instanceName}`);
        
        // ✅ FASE 2: Recarregar connectionMeta do banco (não usar connectionUpdate do evento)
        const { data: connectionMeta, error: metaError } = await supabase
          .from('connections')
          .select('history_days, history_recovery, history_sync_status, history_sync_started_at')
          .eq('instance_name', instanceName)
          .eq('workspace_id', workspaceId)
          .single();
        
        if (metaError || !connectionMeta) {
          console.warn(`⚠️ [${requestId}] No connection metadata found for ${instanceName}:`, metaError);
        } else if ((connectionMeta.history_sync_status === 'pending' || 
                    connectionMeta.history_sync_status === 'failed' ||
                    // Detectar sync travado: syncing há mais de 10 minutos sem progresso
                    (connectionMeta.history_sync_status === 'syncing' && 
                     connectionMeta.history_sync_started_at &&
                     (Date.now() - new Date(connectionMeta.history_sync_started_at).getTime()) > 600000)) &&
                   (connectionMeta.history_days > 0 || connectionMeta.history_recovery !== 'none')) {
          
          // Se estava travado, resetar primeiro
          if (connectionMeta.history_sync_status === 'syncing') {
            console.log(`🔄 [${requestId}] Sync stuck detected, resetting status for ${instanceName}`);
            await supabase
              .from('connections')
              .update({ history_sync_status: 'pending' })
              .eq('instance_name', instanceName)
              .eq('workspace_id', workspaceId);
          }
          
          console.log(`🔄 [${requestId}] Triggering history sync for ${instanceName} (days: ${connectionMeta.history_days}, recovery: ${connectionMeta.history_recovery})`);
          
          // Chamar função separada para forçar sincronização
          try {
            const { data: syncResult, error: syncError } = await supabase.functions.invoke('evolution-trigger-history-sync', {
              body: {
                instanceName,
                workspaceId,
                historyDays: connectionMeta.history_days,
                historyRecovery: connectionMeta.history_recovery
              }
            });
            
            if (syncError) {
              console.error(`❌ [${requestId}] Error invoking history sync:`, syncError);
            } else {
              console.log(`✅ [${requestId}] History sync triggered:`, syncResult);
            }
          } catch (invokeError) {
            console.error(`❌ [${requestId}] Exception invoking history sync:`, invokeError);
          }
        } else {
          console.log(`ℹ️ [${requestId}] No history sync needed: status=${connectionMeta?.history_sync_status}, days=${connectionMeta?.history_days}, recovery=${connectionMeta?.history_recovery}`);
        }
      }
      
      processedData = {
        connection_updated: true,
        phone_number: phoneNumber,
        state: state
      };
    }

    // ✅ NOVA REGRA: NÃO processar mensagens localmente - APENAS enviar metadados para N8N
    if (workspaceId && payload.data && (payload.data.message || EVENT.includes('MESSAGE')) && payload.data?.key?.fromMe === false) {
      console.log(`📝 [${requestId}] Inbound message detected - preparing metadata for N8N (NO local processing)`);
      
      const messageData = payload.data;
      const remoteJid = messageData.key?.remoteJid || '';
      
      // 🚫 FILTRAR MENSAGENS DE GRUPOS E BROADCASTS
      if (remoteJid.endsWith('@g.us')) {
        console.log(`🚫 [${requestId}] Ignoring GROUP message from: ${remoteJid}`);
        processedData = {
          skipped: true,
          reason: 'group_message',
          remoteJid: remoteJid
        };
      } else if (remoteJid.endsWith('@broadcast')) {
        console.log(`🚫 [${requestId}] Ignoring BROADCAST message from: ${remoteJid}`);
        processedData = {
          skipped: true,
          reason: 'broadcast_message',
          remoteJid: remoteJid
        };
      } else {
        // ✅ Preparar apenas metadados para o N8N processar
        const phoneNumber = extractPhoneFromRemoteJid(remoteJid);
        const evolutionMessageId = messageData.key?.id; // 22 chars
        const evolutionKeyId = payload.data?.keyId || messageData.keyId; // 40 chars (if available)
        
        console.log(`🔑 [${requestId}] Message IDs captured for N8N:`);
        console.log(`   - key.id (22 chars): "${evolutionMessageId}"`);
        console.log(`   - keyId (40 chars): "${evolutionKeyId}"`);
        
        processedData = {
          phone_number: phoneNumber,
          external_id: evolutionMessageId,
          evolution_key_id: evolutionKeyId,
          instance: instanceName,
          connection_id: connectionData?.id,
          direction: 'inbound',
          requires_processing: true,
          message_type: messageData.message?.audioMessage ? 'audio' :
                       messageData.message?.imageMessage ? 'image' : 
                       messageData.message?.videoMessage ? 'video' :
                       messageData.message?.documentMessage ? 'document' : 'text'
        };
        
        console.log(`✅ [${requestId}] Metadata prepared for N8N processing:`, processedData);
        
        // ℹ️ AI agent logic is now handled entirely by N8N
        // N8N will query conversations.agente_ativo and invoke AI processing as needed
        
        // 🔔 VERIFICAR AUTOMAÇÕES DE MENSAGENS RECEBIDAS (async, não bloqueia webhook)
        if (processedData?.requires_processing && phoneNumber) {
          console.log(`🔍 [${requestId}] Verificando automações de mensagens recebidas...`);
          
          // Chamar de forma assíncrona (não esperar resposta)
          Promise.resolve().then(async () => {
            try {
              // Buscar contato pelo telefone
              const { data: contact } = await supabase
                .from('contacts')
                .select('id')
                .eq('phone', phoneNumber)
                .eq('workspace_id', workspaceId)
                .maybeSingle();
              
              if (!contact) {
                console.log(`ℹ️ [${requestId}] Contato não encontrado para ${phoneNumber}`);
                return;
              }
              
              // Buscar conversa do contato
              const { data: conversation } = await supabase
                .from('conversations')
                .select('id')
                .eq('contact_id', contact.id)
                .eq('workspace_id', workspaceId)
                .eq('status', 'open')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
              
              console.log(`🔍 [${requestId}] Verificando automações para contato ${contact.id}, conversa ${conversation?.id}`);
              
              const { error } = await supabase.functions.invoke('check-message-automations', {
                body: {
                  contactId: contact.id,
                  conversationId: conversation?.id,
                  workspaceId: workspaceId,
                  phoneNumber: phoneNumber
                }
              });
              
              if (error) {
                console.error(`❌ [${requestId}] Erro ao verificar automações:`, error);
              } else {
                console.log(`✅ [${requestId}] Automações verificadas`);
              }
            } catch (err) {
              console.error(`❌ [${requestId}] Exceção ao verificar automações:`, err);
            }
          });
        }
        
        // ✅ AUTO-CRIAR CARD NO CRM (se habilitado na conexão)
        if (connectionData?.auto_create_crm_card && processedData?.requires_processing) {
          console.log(`🎯 [${requestId}] Auto-criação de card habilitada - processando...`);
          
          try {
            // 1. Buscar ou criar contato
            const { data: contact } = await supabase
              .from('contacts')
              .select('id')
              .eq('phone', phoneNumber)
              .eq('workspace_id', workspaceId)
              .maybeSingle();
            
            if (!contact) {
              console.warn(`⚠️ [${requestId}] Contato não encontrado: ${phoneNumber} - será criado pelo N8N`);
            } else {
              // 2. Criar ou obter conversa
              const conversation = await getOrCreateConversation(
                supabase,
                phoneNumber,
                contact.id,
                connectionData.id,
                workspaceId,
                instanceName,
                connectionData.phone_number
              );
              
              if (!conversation) {
                console.error(`❌ [${requestId}] Falha ao criar/obter conversa`);
              } else {
                console.log(`✅ [${requestId}] Conversa obtida/criada: ${conversation.id}`);
                
                // 3. Verificar se já existe card aberto
                const { data: existingCard } = await supabase
                  .from('pipeline_cards')
                  .select(`
                    id,
                    title,
                    connection_id,
                    conversation:conversation_id (
                      id,
                      connection_phone
                    )
                  `)
                  .eq('contact_id', contact.id)
                  .eq('pipeline_id', connectionData.default_pipeline_id)
                  .eq('status', 'aberto')
                  .maybeSingle();
                
                const cardConnectionPhone = existingCard?.conversation?.[0]?.connection_phone || null;
                const shouldReuseExistingCard = Boolean(
                  existingCard &&
                  (
                    (connectionData?.id && existingCard.connection_id === connectionData.id) ||
                    (!connectionData?.id &&
                      (!connectionData.phone_number || !cardConnectionPhone || cardConnectionPhone === connectionData.phone_number))
                  )
                );

                if (shouldReuseExistingCard && existingCard) {
                  console.log(`✅ [${requestId}] Card já existe: ${existingCard.id} - "${existingCard.title}"`);
                } else {
                  console.log(`🆕 [${requestId}] Criando card para contato ${contact.id}`);
                  
                  // 4. Chamar smart-pipeline-card-manager
                  const { data: cardResult, error: cardError } = await supabase.functions.invoke(
                    'smart-pipeline-card-manager',
                    {
                      body: {
                        contactId: contact.id,
                        conversationId: conversation.id,
                        workspaceId: workspaceId,
                        pipelineId: connectionData.default_pipeline_id,
                        connectionPhone: connectionData.phone_number,
                        connectionId: connectionData.id
                      }
                    }
                  );
                  
                  if (cardError) {
                    console.error(`❌ [${requestId}] Erro ao criar card:`, cardError);
                  } else {
                    console.log(`✅ [${requestId}] Card ${cardResult?.action}: ${cardResult?.card?.id}`);
                  }
                }
              }
            }
          } catch (cardCreationError) {
            console.error(`❌ [${requestId}] Exceção ao processar auto-criação:`, cardCreationError);
          }
        } else if (connectionData?.auto_create_crm_card) {
          console.log(`ℹ️ [${requestId}] Auto-criação habilitada mas mensagem não requer processamento`);
        }
        
      }
    } else if (workspaceId && payload.data?.key?.fromMe === true && EVENT === 'MESSAGES_UPSERT') {
      console.log(`📤 [${requestId}] Outbound message detected (messages.upsert), capturing evolution_short_key_id`);
      
      const shortKeyId = payload.data?.key?.id; // 22 chars
      
      if (shortKeyId && workspaceId) {
        // Buscar mensagem enviada nos últimos 30 segundos sem evolution_short_key_id
        const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
        
        const { data: recentMessage } = await supabase
          .from('messages')
          .select('id, evolution_key_id, external_id')
          .eq('workspace_id', workspaceId)
          .eq('sender_type', 'agent')
          .is('evolution_short_key_id', null)
          .gte('created_at', thirtySecondsAgo)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (recentMessage) {
          console.log(`💾 [${requestId}] Saving evolution_short_key_id: ${shortKeyId} for message ${recentMessage.id}`);
          
          await supabase
            .from('messages')
            .update({ evolution_short_key_id: shortKeyId })
            .eq('id', recentMessage.id);
          
          console.log(`✅ [${requestId}] evolution_short_key_id saved successfully!`);
        } else {
          console.log(`⚠️ [${requestId}] No recent message found to update with shortKeyId`);
        }
      }
    }

    // ✅ Outbound messages (fromMe=true): include minimal metadata so N8N can route dynamically
    if (!processedData && workspaceId && payload.data && (payload.data.message || EVENT.includes('MESSAGE')) && payload.data?.key?.fromMe === true) {
      const messageData = payload.data;
      const remoteJid = messageData.key?.remoteJid || '';

      // Ignore group/broadcast outbound messages as well
      if (remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast')) {
        processedData = {
          skipped: true,
          reason: remoteJid.endsWith('@g.us') ? 'group_message' : 'broadcast_message',
          remoteJid,
        };
      } else {
        const phoneNumber = remoteJid ? extractPhoneFromRemoteJid(remoteJid) : null;
        const evolutionMessageId = messageData.key?.id; // 22 chars
        const evolutionKeyId = payload.data?.keyId || messageData.keyId; // 40 chars (if available)

        processedData = {
          phone_number: phoneNumber,
          external_id: evolutionMessageId,
          evolution_key_id: evolutionKeyId,
          instance: instanceName,
          connection_id: connectionData?.id,
          direction: 'outbound',
          requires_processing: false,
        };
      }
    }

    // ✅ FORWARD OBRIGATÓRIO AO N8N - Com fallback
    const finalWebhookUrl = webhookUrl || Deno.env.get('N8N_FALLBACK_URL');
    
    if (!finalWebhookUrl) {
      console.error(`❌ [${requestId}] NO WEBHOOK URL - MESSAGE LOST!`, {
        event: EVENT,
        workspace_id: workspaceId,
        instance: instanceName
      });
    }
    
    console.log(`🔍 [${requestId}] Pre-send check:`, {
      has_webhookUrl: !!finalWebhookUrl,
      webhookUrl_value: finalWebhookUrl ? finalWebhookUrl.substring(0, 50) + '...' : 'NULL',
      has_processedData: !!processedData
    });
    
    if (finalWebhookUrl) {
      console.log(`🚀 [${requestId}] Forwarding to N8N: ${finalWebhookUrl}`);
      
      // ✅ HEADERS PADRONIZADOS - Sempre consistentes
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      if (webhookSecret) {
        headers['Authorization'] = `Bearer ${webhookSecret}`;
      }

      try {
        // Debug log the payload structure
        console.log(`🔍 [${requestId}] Debug payload structure:`, {
          event: payload.event,
          fromMe: payload.data?.key?.fromMe,
          messageType: payload.data?.messageType,
          conversation: payload.data?.message?.conversation,
          hasMessage: !!payload.data?.message,
          messageKeys: payload.data?.message ? Object.keys(payload.data.message) : []
        });

        // ✅ FASE 1.1: Removido bloco duplicado de MESSAGES_UPDATE
        // O processamento de ACKs agora é feito apenas no bloco principal (linhas 109-343)

        // ✅ CORREÇÃO 3: Debug N8N payload antes de preparar
        console.log(`🔍 [${requestId}] Pre-send N8N payload check:`, {
          has_processed_data: !!processedData,
          event: payload.event,
          has_original_message: !!payload.data?.message,
          has_key: !!payload.data?.key,
          processed_data_keys: processedData ? Object.keys(processedData) : null
        });

        // Prepare N8N payload with ORIGINAL Evolution data structure + context
        const resolvedConnectionId = (processedData as any)?.connection_id || connectionData?.id || null;
        const n8nPayload = {
          // Original Evolution API payload (preserving ALL data from Evolution)
          ...payload,
          
          // Additional context fields for convenience
          workspace_id: workspaceId,
          connection_id: resolvedConnectionId,
          instance_name: instanceName || null,
          connection_phone: connectionData?.phone_number || null,
          processed_data: processedData,
          timestamp: new Date().toISOString(),
          request_id: requestId,
          
          // Event type identification for N8N processing (based on original event)
          event_type: (() => {
            const eventLower = payload.event?.toLowerCase() || '';
            const isUpdate = eventLower.endsWith('update');
            console.log(`🔍 [${requestId}] Event type determination: event="${payload.event}", lower="${eventLower}", endsWithUpdate=${isUpdate}, result="${isUpdate ? 'update' : 'upsert'}"`);
            return isUpdate ? 'update' : 'upsert';
          })(),
          processed_locally: !!processedData,
          
          // Computed fields for convenience (but original data is preserved above)
          message_direction: payload.data?.key?.fromMe === true ? 'outbound' : 'inbound',
          phone_number: payload.data?.key?.remoteJid ? extractPhoneFromRemoteJid(payload.data.key.remoteJid) : null,
          
          // Debug info
          debug_info: {
            original_payload_keys: Object.keys(payload),
            data_keys: payload.data ? Object.keys(payload.data) : [],
            message_keys: payload.data?.message ? Object.keys(payload.data.message) : [],
            fromMe_value: payload.data?.key?.fromMe,
            calculated_direction: payload.data?.key?.fromMe === true ? 'outbound' : 'inbound',
            is_message_update: false // MESSAGES_UPDATE já retorna antes, então aqui sempre é false
          }
        };

        console.log(`🚀 [${requestId}] Sending to N8N:`, {
          url: finalWebhookUrl,
          original_event: payload.event,
          event_type: n8nPayload.event_type,
          processed_locally: n8nPayload.processed_locally,
          has_processed_data: !!n8nPayload.processed_data
        });

        const response = await fetch(finalWebhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(n8nPayload)
        });

        console.log(`✅ [${requestId}] N8N webhook called successfully, status: ${response.status}`);
        
      } catch (error) {
        console.error(`❌ [${requestId}] Error calling N8N webhook:`, error);
      }
    } else {
      console.warn(`⚠️ [${requestId}] NOT sending to N8N - webhookUrl is null/undefined`);
    }

    // Always return processed data or basic structure
    return new Response(JSON.stringify({
      success: true,
      action: 'processed_and_forwarded',
      message_id: (processedData as any)?.message_id || crypto.randomUUID(),
      workspace_id: (processedData as any)?.workspace_id || workspaceId,
      conversation_id: (processedData as any)?.conversation_id,
      contact_id: (processedData as any)?.contact_id,
      connection_id: (processedData as any)?.connection_id,
      instance: (processedData as any)?.instance,
      phone_number: (processedData as any)?.phone_number,
      requestId
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error(`❌ [${requestId}] Error processing Evolution webhook:`, error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: (error as Error).message,
      requestId
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
