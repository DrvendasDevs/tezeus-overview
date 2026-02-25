import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface LabSession {
  id: string;
  user_id: string;
  agent_id: string;
  workspace_id: string;
  webhook_url: string;
  contact_phone: string;
  contact_name: string;
  connection_id: string;
  contact_id: string | null;
  conversation_id: string | null;
  card_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface LabMessage {
  id: string;
  session_id: string;
  sender_type: 'user' | 'agent';
  content: string;
  created_at: string;
}

export interface LabActionLog {
  id: string;
  session_id: string;
  message_content?: string;
  action_type: string;
  action_params: Record<string, any>;
  status: 'pending' | 'success' | 'error';
  error_message?: string;
  executed_at?: string;
  created_at: string;
}

interface ConnectionData {
  id: string;
  instance_name: string;
  phone_number: string;
  workspace_id: string;
  metadata?: any;
  default_pipeline_id?: string;
  default_column_id?: string;
  queue_id?: string;
}

interface StartSessionConfig {
  agentId: string;
  workspaceId: string;
  connectionId: string;
  connectionData?: ConnectionData; // Dados da conexão já carregados (evita RLS)
  phone: string;
  name?: string;
  webhookUrl: string;
}

interface UseLabSessionReturn {
  session: LabSession | null;
  messages: LabMessage[];
  actions: LabActionLog[];
  isLoading: boolean;
  isSending: boolean;
  isInitialized: boolean;
  startSession: (config: StartSessionConfig) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  endSession: () => Promise<void>;
}

export function useLabSession(): UseLabSessionReturn {
  const { user } = useAuth();
  const [session, setSession] = useState<LabSession | null>(null);
  const [messages, setMessages] = useState<LabMessage[]>([]);
  const [actions, setActions] = useState<LabActionLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Carregar mensagens e ações da sessão atual
  const loadSessionData = useCallback(async (sessionId: string) => {
    try {
      // Buscar mensagens
      const { data: messagesData, error: messagesError } = await supabase
        .from('lab_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;
      setMessages(messagesData || []);

      // Buscar ações
      const { data: actionsData, error: actionsError } = await supabase
        .from('lab_action_logs')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (actionsError) throw actionsError;
      setActions(actionsData || []);
    } catch (error) {
      console.error('[Lab] Erro ao carregar dados da sessão:', error);
    }
  }, []);

  // Iniciar nova sessão - cria contato, conversa e card reais
  const startSession = useCallback(async (config: StartSessionConfig) => {
    if (!user) {
      toast.error('Usuário não autenticado');
      return;
    }

    setIsLoading(true);
    try {
      console.log('[Lab] Iniciando sessão com config:', config);

      // 1. Usar dados da conexão passados diretamente (evita RLS)
      let connection: ConnectionData | null = null;

      if (config.connectionData) {
        // Dados já passados do frontend
        connection = config.connectionData;
        console.log('[Lab] Usando dados da conexão já carregados:', connection.instance_name);
      } else {
        // Fallback: tentar buscar via RPC
        console.log('[Lab] Buscando conexão via RPC...');
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_lab_data');
        
        if (rpcError) {
          console.error('[Lab] Erro na RPC:', rpcError);
          throw new Error('Erro ao buscar dados: ' + rpcError.message);
        }

        const foundConnection = rpcData?.connections?.find((c: any) => c.id === config.connectionId);
        if (foundConnection) {
          connection = {
            id: foundConnection.id,
            instance_name: foundConnection.instance_name,
            phone_number: foundConnection.phone_number,
            workspace_id: foundConnection.workspace_id,
            metadata: foundConnection.metadata,
            default_pipeline_id: foundConnection.default_pipeline_id,
            default_column_id: foundConnection.default_column_id,
            queue_id: foundConnection.queue_id
          };
        }
      }

      if (!connection) {
        throw new Error('Conexão não encontrada');
      }

      console.log('[Lab] Conexão encontrada:', connection.instance_name);

      // 2. LIMPAR registros antigos de teste com o mesmo telefone (evita conflitos)
      console.log('[Lab] Limpando registros antigos de teste com telefone:', config.phone);
      
      // Buscar contatos de teste existentes com o mesmo telefone
      const { data: existingContacts } = await supabase
        .from('contacts')
        .select('id')
        .eq('phone', config.phone)
        .eq('workspace_id', config.workspaceId)
        .eq('is_lab_test', true);

      if (existingContacts && existingContacts.length > 0) {
        console.log('[Lab] Encontrados', existingContacts.length, 'contatos de teste antigos. Deletando...');
        
        for (const oldContact of existingContacts) {
          // Deletar conversas associadas
          const { data: oldConvs } = await supabase
            .from('conversations')
            .select('id')
            .eq('contact_id', oldContact.id);

          if (oldConvs) {
            for (const oldConv of oldConvs) {
              // Deletar cards
              await supabase.from('pipeline_cards').delete().eq('conversation_id', oldConv.id);
              // Deletar mensagens
              await supabase.from('messages').delete().eq('conversation_id', oldConv.id);
              // Deletar tags da conversa
              await supabase.from('conversation_tags').delete().eq('conversation_id', oldConv.id);
              // Deletar histórico de agentes
              await supabase.from('conversation_agent_history').delete().eq('conversation_id', oldConv.id);
            }
            // Deletar conversas
            await supabase.from('conversations').delete().eq('contact_id', oldContact.id);
          }
          
          // Deletar tags do contato
          await supabase.from('contact_tags').delete().eq('contact_id', oldContact.id);
          // Deletar contato
          await supabase.from('contacts').delete().eq('id', oldContact.id);
        }
        console.log('[Lab] Registros antigos de teste deletados');
      }

      // 3. Criar contato de teste
      const contactInsertData: Record<string, any> = {
        name: config.name || 'Contato de Teste',
        phone: config.phone,
        workspace_id: config.workspaceId
      };

      // Tentar primeiro com is_lab_test
      let contact = null;
      let contactError = null;

      const { data: contactWithFlag, error: errWithFlag } = await supabase
        .from('contacts')
        .insert({ ...contactInsertData, is_lab_test: true })
        .select()
        .single();

      if (errWithFlag) {
        // Se deu erro (provavelmente coluna não existe), tentar sem a flag
        console.log('[Lab] Tentando criar contato sem is_lab_test...');
        const { data: contactWithoutFlag, error: errWithoutFlag } = await supabase
          .from('contacts')
          .insert(contactInsertData)
          .select()
          .single();
        
        contact = contactWithoutFlag;
        contactError = errWithoutFlag;
      } else {
        contact = contactWithFlag;
      }

      if (contactError || !contact) {
        console.error('[Lab] Erro ao criar contato:', contactError);
        throw new Error('Erro ao criar contato de teste: ' + (contactError?.message || 'desconhecido'));
      }

      console.log('[Lab] Contato criado:', contact.id);

      // 4. Criar conversa de teste
      const convInsertData: Record<string, any> = {
        contact_id: contact.id,
        workspace_id: config.workspaceId,
        connection_id: config.connectionId,
        queue_id: connection.queue_id || null,
        status: 'open',
        agente_ativo: true,
        agent_active_id: config.agentId,
        canal: 'whatsapp',
        evolution_instance: connection.instance_name
      };

      // Tentar primeiro com is_lab_test
      let conversation = null;
      let convError = null;

      const { data: convWithFlag, error: convErrWithFlag } = await supabase
        .from('conversations')
        .insert({ ...convInsertData, is_lab_test: true })
        .select()
        .single();

      if (convErrWithFlag) {
        // Se deu erro, tentar sem a flag
        console.log('[Lab] Tentando criar conversa sem is_lab_test...');
        const { data: convWithoutFlag, error: convErrWithoutFlag } = await supabase
          .from('conversations')
          .insert(convInsertData)
          .select()
          .single();
        
        conversation = convWithoutFlag;
        convError = convErrWithoutFlag;
      } else {
        conversation = convWithFlag;
      }

      if (convError || !conversation) {
        console.error('[Lab] Erro ao criar conversa:', convError);
        // Tentar limpar o contato criado
        await supabase.from('contacts').delete().eq('id', contact.id);
        throw new Error('Erro ao criar conversa de teste: ' + (convError?.message || 'desconhecido'));
      }

      console.log('[Lab] Conversa criada:', conversation.id);

      // 5. Criar card de teste (se tiver pipeline configurado)
      let cardId: string | null = null;
      if (connection.default_pipeline_id && connection.default_column_id) {
        const cardInsertData: Record<string, any> = {
          pipeline_id: connection.default_pipeline_id,
          column_id: connection.default_column_id,
          contact_id: contact.id,
          conversation_id: conversation.id,
          status: 'aberto',
          value: 0
        };

        const { data: cardWithFlag, error: cardErrWithFlag } = await supabase
          .from('pipeline_cards')
          .insert({ ...cardInsertData, is_lab_test: true })
          .select()
          .single();

        if (cardErrWithFlag) {
          // Tentar sem flag
          const { data: cardWithoutFlag, error: cardErrWithoutFlag } = await supabase
            .from('pipeline_cards')
            .insert(cardInsertData)
            .select()
            .single();

          if (!cardErrWithoutFlag && cardWithoutFlag) {
            cardId = cardWithoutFlag.id;
            console.log('[Lab] Card criado (sem flag):', cardId);
          } else {
            console.error('[Lab] Erro ao criar card:', cardErrWithoutFlag);
          }
        } else if (cardWithFlag) {
          cardId = cardWithFlag.id;
          console.log('[Lab] Card criado:', cardId);
        }
      }

      // 6. Criar sessão do laboratório
      const sessionInsertData: Record<string, any> = {
        user_id: user.id,
        agent_id: config.agentId,
        workspace_id: config.workspaceId,
        webhook_url: config.webhookUrl,
        contact_phone: config.phone,
        contact_name: config.name || 'Contato de Teste',
        is_active: true
      };

      // Tentar adicionar IDs se as colunas existirem
      const { data: labSession, error: sessionError } = await supabase
        .from('lab_sessions')
        .insert({
          ...sessionInsertData,
          connection_id: config.connectionId,
          contact_id: contact.id,
          conversation_id: conversation.id,
          card_id: cardId
        })
        .select()
        .single();

      if (sessionError) {
        console.error('[Lab] Erro ao criar sessão:', sessionError);
        // Limpar registros criados
        if (cardId) await supabase.from('pipeline_cards').delete().eq('id', cardId);
        await supabase.from('conversations').delete().eq('id', conversation.id);
        await supabase.from('contacts').delete().eq('id', contact.id);
        throw new Error('Erro ao criar sessão de teste: ' + sessionError.message);
      }

      setSession(labSession);
      setMessages([]);
      setActions([]);
      toast.success('Sessão de teste iniciada! Contato, conversa e card criados.');
    } catch (error: any) {
      console.error('[Lab] Erro ao criar sessão:', error);
      toast.error('Erro ao iniciar sessão: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Enviar mensagem para o N8N
  const sendMessage = useCallback(async (content: string) => {
    if (!session) {
      toast.error('Nenhuma sessão ativa');
      return;
    }

    // Adicionar mensagem do usuário imediatamente (optimistic update)
    const tempUserMessage: LabMessage = {
      id: `temp_${Date.now()}`,
      session_id: session.id,
      sender_type: 'user',
      content: content,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMessage]);

    setIsSending(true);
    try {
      console.log('[Lab] Enviando mensagem para Edge Function...');
      
      // Chamar Edge Function (ela vai salvar a mensagem e o Realtime vai atualizar)
      const { data, error } = await supabase.functions.invoke('lab-send-message', {
        body: {
          session_id: session.id,
          message_content: content
        }
      });

      console.log('[Lab] Resposta da Edge Function:', data, error);

      if (error) throw error;

      // Verificar se o webhook foi enviado com sucesso
      if (data && !data.success) {
        console.error('[Lab] Webhook falhou:', data.webhook_error);
        console.error('[Lab] URL usada:', data.webhook_url_used);
        console.error('[Lab] Status HTTP:', data.webhook_response_status);
        toast.error(`Erro no webhook: ${data.webhook_error || 'Erro desconhecido'}`);
      } else if (data && data.webhook_status === 'success') {
        console.log('[Lab] Webhook enviado com sucesso para:', data.webhook_url_used);
      }

      // O Realtime vai atualizar as mensagens automaticamente
      // Não precisamos mais do loadSessionData aqui

    } catch (error: any) {
      console.error('[Lab] Erro ao enviar mensagem:', error);
      toast.error('Erro ao enviar mensagem: ' + error.message);
      // Remover a mensagem temporária em caso de erro
      setMessages(prev => prev.filter(m => m.id !== tempUserMessage.id));
    } finally {
      setIsSending(false);
    }
  }, [session]);

  // Limpar histórico
  const clearHistory = useCallback(async () => {
    if (!session) {
      toast.error('Nenhuma sessão ativa');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.functions.invoke('lab-clear-history', {
        body: { session_id: session.id }
      });

      if (error) throw error;

      setMessages([]);
      setActions([]);
      toast.success('Histórico limpo!');
    } catch (error: any) {
      console.error('[Lab] Erro ao limpar histórico:', error);
      toast.error('Erro ao limpar histórico: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  // Encerrar sessão - limpa os registros de teste
  const endSession = useCallback(async () => {
    if (!session) return;

    setIsLoading(true);
    try {
      // Chamar função para limpar tudo (inclui contato, conversa, card)
      const { error } = await supabase.functions.invoke('lab-clear-history', {
        body: { 
          session_id: session.id,
          delete_test_records: true 
        }
      });

      if (error) {
        console.error('[Lab] Erro ao encerrar sessão:', error);
      }

      setSession(null);
      setMessages([]);
      setActions([]);
      toast.success('Sessão deletada e registros de teste removidos.');
    } catch (error: any) {
      console.error('[Lab] Erro ao encerrar sessão:', error);
      // Mesmo com erro, limpar estado local
      setSession(null);
      setMessages([]);
      setActions([]);
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  // Recuperar sessão ativa ao inicializar
  useEffect(() => {
    if (!user || initialized) return;

    async function loadActiveSession() {
      try {
        console.log('[Lab] Buscando sessão ativa para o usuário:', user.id);
        
        // Buscar sessão ativa do usuário
        const { data: activeSession, error } = await supabase
          .from('lab_sessions')
          .select('*')
          .eq('user_id', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('[Lab] Erro ao buscar sessão ativa:', error);
          return;
        }

        if (activeSession) {
          console.log('[Lab] Sessão ativa encontrada:', activeSession.id);
          setSession(activeSession);
          
          // Carregar mensagens e ações da sessão
          await loadSessionData(activeSession.id);
        } else {
          console.log('[Lab] Nenhuma sessão ativa encontrada');
        }
      } catch (err) {
        console.error('[Lab] Erro ao recuperar sessão:', err);
      } finally {
        setInitialized(true);
      }
    }

    loadActiveSession();
  }, [user, initialized, loadSessionData]);

  // Realtime subscription para mensagens e ações
  useEffect(() => {
    if (!session) return;

    console.log('[Lab] Configurando Realtime para sessão:', session.id);

    // Subscribe para mensagens
    const messagesChannel = supabase
      .channel(`lab_messages_${session.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'lab_messages',
          filter: `session_id=eq.${session.id}`
        },
        (payload) => {
          console.log('[Lab] Realtime: Nova mensagem recebida:', payload.new);
          const newMessage = payload.new as LabMessage;
          
          setMessages(prev => {
            // Verificar se já existe uma mensagem com esse ID (evitar duplicatas)
            const exists = prev.some(m => m.id === newMessage.id);
            if (exists) {
              console.log('[Lab] Mensagem já existe, ignorando duplicata');
              return prev;
            }
            
            // Se for mensagem do usuário, remover a temporária correspondente
            if (newMessage.sender_type === 'user') {
              // Remover mensagens temporárias do usuário (que começam com temp_)
              const withoutTemp = prev.filter(m => !m.id.startsWith('temp_'));
              return [...withoutTemp, newMessage];
            }
            
            return [...prev, newMessage];
          });
        }
      )
      .subscribe((status) => {
        console.log('[Lab] Realtime messages status:', status);
      });

    // Subscribe para ações
    const actionsChannel = supabase
      .channel(`lab_actions_${session.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lab_action_logs',
          filter: `session_id=eq.${session.id}`
        },
        (payload) => {
          console.log('[Lab] Realtime: Nova ação recebida:', payload.eventType, payload.new);
          if (payload.eventType === 'INSERT') {
            setActions(prev => {
              // Evitar duplicatas
              const exists = prev.some(a => a.id === (payload.new as LabActionLog).id);
              if (exists) return prev;
              return [...prev, payload.new as LabActionLog];
            });
          } else if (payload.eventType === 'UPDATE') {
            setActions(prev => 
              prev.map(a => a.id === payload.new.id ? payload.new as LabActionLog : a)
            );
          }
        }
      )
      .subscribe((status) => {
        console.log('[Lab] Realtime actions status:', status);
      });

    return () => {
      console.log('[Lab] Desconectando Realtime');
      messagesChannel.unsubscribe();
      actionsChannel.unsubscribe();
    };
  }, [session]);

  return {
    session,
    messages,
    actions,
    isLoading,
    isSending,
    isInitialized: initialized,
    startSession,
    sendMessage,
    clearHistory,
    endSession
  };
}
