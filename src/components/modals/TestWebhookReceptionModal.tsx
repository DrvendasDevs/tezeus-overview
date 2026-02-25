import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspaceHeaders } from "@/lib/workspaceHeaders";
import { getSupabaseFunctionUrl } from "@/lib/config";
import { Loader2, Bug, CheckCircle, XCircle, AlertCircle } from "lucide-react";
export const TestWebhookReceptionModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [testResults, setTestResults] = useState<any[]>([]);
  const [currentStatus, setCurrentStatus] = useState<string>("");
  const {
    toast
  } = useToast();
  const {
    selectedWorkspace
  } = useWorkspace();
  const {
    getHeaders
  } = useWorkspaceHeaders();
  const configureTestWebhook = async () => {
    if (!selectedWorkspace?.workspace_id) {
      toast({
        title: "Erro",
        description: "Nenhum workspace selecionado",
        variant: "destructive"
      });
      return;
    }
    setIsConfiguring(true);
    setTestResults([]);
    setCurrentStatus("Configurando webhook de teste...");
    try {
      // Configure webhook to point to our test function
      const {
        data,
        error
      } = await supabase.functions.invoke('configure-evolution-webhook', {
        body: {
          instance_name: 'emp',
          // Use the actual instance name from your connection
          webhookUrl: getSupabaseFunctionUrl('test-webhook-reception'),
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED']
        },
        headers: getHeaders()
      });
      if (error) {
        console.error('Configure webhook error:', error);
        setCurrentStatus(`Erro: ${error.message}`);
        toast({
          title: "Erro ao Configurar",
          description: `Erro: ${error.message || 'Erro desconhecido'}`,
          variant: "destructive"
        });
        return;
      }
      setCurrentStatus("Webhook configurado! Aguardando mensagens...");
      toast({
        title: "Webhook Configurado",
        description: "Webhook de teste configurado. Agora envie uma mensagem do celular."
      });

      // Start monitoring for webhook logs after a brief delay
      setTimeout(() => {
        monitorWebhookLogs();
      }, 3000);
    } catch (error: any) {
      console.error('Error configuring test webhook:', error);
      setCurrentStatus(`Erro: ${error.message}`);
      toast({
        title: "Erro ao Configurar",
        description: error.message || "Erro ao configurar webhook de teste",
        variant: "destructive"
      });
    } finally {
      setIsConfiguring(false);
    }
  };
  const monitorWebhookLogs = async () => {
    try {
      console.log('🔍 Monitorando logs de webhook...');
      const {
        data: logs,
        error
      } = await supabase.from('webhook_logs').select('*').eq('workspace_id', selectedWorkspace?.workspace_id).eq('event_type', 'test-reception').order('created_at', {
        ascending: false
      }).limit(10);
      if (error) {
        console.error('Error fetching webhook logs:', error);
        setCurrentStatus(`Erro ao buscar logs: ${error.message}`);
        return;
      }
      console.log(`📋 Encontrados ${logs?.length || 0} logs de webhook`);
      setTestResults(logs || []);
      if (logs && logs.length > 0) {
        setCurrentStatus(`${logs.length} webhook(s) recebido(s)!`);
        toast({
          title: "Webhooks Detectados!",
          description: `${logs.length} webhook(s) recebido(s)`
        });
      } else {
        setCurrentStatus("Aguardando mensagens... Envie uma mensagem do celular.");
      }
    } catch (error: any) {
      console.error('Error monitoring webhook logs:', error);
      setCurrentStatus(`Erro ao monitorar: ${error.message}`);
    }
  };
  const restoreOriginalWebhook = async () => {
    try {
      setCurrentStatus("Restaurando webhook original...");

      // Get workspace webhook settings
      const {
        data: webhookSettings
      } = await supabase.from('workspace_webhook_settings').select('webhook_url').eq('workspace_id', selectedWorkspace?.workspace_id).single();
      const originalUrl = webhookSettings?.webhook_url || getSupabaseFunctionUrl('evolution-webhook');
      const {
        error
      } = await supabase.functions.invoke('configure-evolution-webhook', {
        body: {
          instance_name: 'emp',
          // Use the actual instance name
          webhookUrl: originalUrl,
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED']
        },
        headers: getHeaders()
      });
      if (error) {
        throw error;
      }
      setCurrentStatus("Webhook original restaurado!");
      toast({
        title: "Webhook Restaurado",
        description: "Webhook original restaurado com sucesso"
      });
    } catch (error: any) {
      console.error('Error restoring webhook:', error);
      setCurrentStatus(`Erro ao restaurar: ${error.message}`);
      toast({
        title: "Erro ao Restaurar",
        description: error.message || "Erro ao restaurar webhook original",
        variant: "destructive"
      });
    }
  };
  return <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Teste de Recepção de Webhook</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h3 className="font-semibold mb-2">Como Usar:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Clique em "Configurar Webhook de Teste"</li>
              <li>Envie uma mensagem do celular para a instância WhatsApp</li>
              <li>Aguarde os resultados aparecerem abaixo</li>
              <li>Clique em "Restaurar Webhook Original" quando terminar</li>
            </ol>
          </div>

          {currentStatus && <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{currentStatus}</span>
            </div>}

          <div className="flex gap-2">
            <Button onClick={configureTestWebhook} disabled={isConfiguring} className="gap-2">
              {isConfiguring && <Loader2 className="h-4 w-4 animate-spin" />}
              Configurar Webhook de Teste
            </Button>
            
            <Button variant="outline" onClick={monitorWebhookLogs}>
              Atualizar Resultados
            </Button>

            <Button variant="secondary" onClick={restoreOriginalWebhook}>
              Restaurar Webhook Original
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="font-semibold">Resultados do Teste:</h3>
            {testResults.length === 0 ? <p className="text-muted-foreground">Nenhum webhook recebido ainda. Envie uma mensagem do celular.</p> : <div className="space-y-2 max-h-60 overflow-y-auto">
                {testResults.map((result, index) => <div key={result.id} className="border rounded-lg p-3 bg-card">
                    <div className="flex items-center gap-2 mb-2">
                      {result.status === 'received' ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                      <span className="font-medium">
                        Webhook #{testResults.length - index}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(result.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm">
                      <div><strong>Método:</strong> {result.payload_json?.method}</div>
                      <div><strong>Status:</strong> {result.response_status}</div>
                      {result.payload_json?.body && <details className="mt-2">
                          <summary className="cursor-pointer text-blue-600">Ver Payload</summary>
                          <pre className="text-xs bg-muted p-2 rounded mt-1 overflow-x-auto">
                            {typeof result.payload_json.body === 'string' ? result.payload_json.body : JSON.stringify(result.payload_json.body, null, 2)}
                          </pre>
                        </details>}
                    </div>
                  </div>)}
              </div>}
          </div>
        </div>
      </DialogContent>
    </Dialog>;
};