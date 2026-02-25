import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface LogEntry {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

export default function TesteNotificacao() {
  const { user } = useAuth();
  const { selectedWorkspace } = useWorkspace();
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      timestamp: new Date().toLocaleTimeString(),
      message,
      type
    }]);
    console.log(`[${type.toUpperCase()}]`, message);
  };

  useEffect(() => {
    if (!user?.id || !selectedWorkspace?.workspace_id) {
      addLog('⚠️ Aguardando usuário e workspace...', 'info');
      return;
    }

    addLog(`🔵 Iniciando teste com user_id: ${user.id}`, 'info');
    addLog(`🔵 Workspace: ${selectedWorkspace.workspace_id}`, 'info');

    // Canal 1: Simples com filtro user_id
    const channel1 = supabase
      .channel(`test-notifications-simple`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          addLog(`✅ RECEBIDO (Canal Simples): ${JSON.stringify(payload.new)}`, 'success');
        }
      )
      .subscribe((status) => {
        addLog(`Canal Simples Status: ${status}`, 'info');
      });

    // Canal 2: Com broadcast config
    const channel2 = supabase
      .channel(`test-notifications-broadcast`, {
        config: {
          broadcast: { self: true }
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          addLog(`✅ RECEBIDO (Canal Broadcast): ${JSON.stringify(payload.new)}`, 'success');
        }
      )
      .subscribe((status) => {
        addLog(`Canal Broadcast Status: ${status}`, 'info');
      });

    // Canal 3: Sem filtro
    const channel3 = supabase
      .channel(`test-notifications-no-filter`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => {
          addLog(`✅ RECEBIDO (Sem Filtro): ${JSON.stringify(payload.new)}`, 'success');
        }
      )
      .subscribe((status) => {
        addLog(`Canal Sem Filtro Status: ${status}`, 'info');
      });

    return () => {
      addLog('🔴 Limpando canais...', 'info');
      supabase.removeChannel(channel1);
      supabase.removeChannel(channel2);
      supabase.removeChannel(channel3);
    };
  }, [user?.id, selectedWorkspace?.workspace_id]);

  const insertTestNotification = async () => {
    if (!user?.id || !selectedWorkspace?.workspace_id) {
      addLog('❌ Usuário ou workspace não disponível', 'error');
      return;
    }

    addLog('🔵 Buscando IDs válidos para o teste...', 'info');

    // Buscar uma conversa existente
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, contact_id')
      .eq('workspace_id', selectedWorkspace.workspace_id)
      .limit(1);

    if (!conversations || conversations.length === 0) {
      addLog('❌ Nenhuma conversa encontrada neste workspace', 'error');
      return;
    }

    // Buscar uma mensagem da conversa
    const { data: messages } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conversations[0].id)
      .limit(1);

    if (!messages || messages.length === 0) {
      addLog('❌ Nenhuma mensagem encontrada', 'error');
      return;
    }

    addLog('🔵 Inserindo notificação de teste...', 'info');

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        workspace_id: selectedWorkspace.workspace_id,
        user_id: user.id,
        conversation_id: conversations[0].id,
        contact_id: conversations[0].contact_id,
        message_id: messages[0].id,
        title: 'TESTE REALTIME',
        content: `Testando realtime ${new Date().toISOString()}`,
        message_type: 'text',
        status: 'unread'
      })
      .select();

    if (error) {
      addLog(`❌ Erro ao inserir: ${error.message}`, 'error');
    } else {
      addLog(`✅ Notificação inserida: ${JSON.stringify(data)}`, 'success');
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Teste de Notificações Realtime</CardTitle>
            <CardDescription>
              Diagnóstico de subscriptions Supabase Realtime
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-center">
              <Button onClick={insertTestNotification}>
                Inserir Notificação de Teste
              </Button>
              <Button variant="outline" onClick={() => setLogs([])}>
                Limpar Logs
              </Button>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                <strong>User ID:</strong> {user?.id || 'Carregando...'}
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>Workspace ID:</strong> {selectedWorkspace?.workspace_id || 'Carregando...'}
              </p>
            </div>

            <div className="border rounded-lg p-4 bg-muted/50 max-h-96 overflow-y-auto">
              <h3 className="font-semibold mb-2">Logs em Tempo Real:</h3>
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aguardando eventos...</p>
              ) : (
                <div className="space-y-1 font-mono text-xs">
                  {logs.map((log, idx) => (
                    <div
                      key={idx}
                      className={
                        log.type === 'success' ? 'text-green-600' :
                        log.type === 'error' ? 'text-red-600' :
                        'text-foreground'
                      }
                    >
                      [{log.timestamp}] {log.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Como Interpretar os Resultados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>📋 <strong>3 canais estão sendo testados:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>Canal Simples:</strong> Subscription com filtro user_id</li>
              <li><strong>Canal Broadcast:</strong> Subscription com broadcast config + filtro user_id</li>
              <li><strong>Canal Sem Filtro:</strong> Subscription sem filtro (recebe todas as notificações)</li>
            </ul>
            <p className="mt-4">✅ <strong>Se apenas "Sem Filtro" funcionar:</strong> Problema com filtros RLS</p>
            <p>✅ <strong>Se apenas "Broadcast" funcionar:</strong> Precisa config broadcast</p>
            <p>✅ <strong>Se nenhum funcionar:</strong> Problema na configuração do Realtime no Supabase</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
