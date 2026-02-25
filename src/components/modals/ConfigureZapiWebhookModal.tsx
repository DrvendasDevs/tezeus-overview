import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Loader2, CheckCircle2, XCircle, Webhook } from 'lucide-react';

interface ConfigureZapiWebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  instanceName: string;
}

export function ConfigureZapiWebhookModal({
  isOpen,
  onClose,
  connectionId,
  instanceName
}: ConfigureZapiWebhookModalProps) {
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [isConfigured, setIsConfigured] = useState(false);

  const configureWebhooks = async () => {
    setIsConfiguring(true);
    setResults([]);
    
    try {
      console.log('🔧 Corrigindo metadados e configurando webhooks do Z-API:', { connectionId, instanceName });
      
      // Primeiro, corrigir os metadados da conexão
      const { data: fixData, error: fixError } = await supabase.functions.invoke('fix-zapi-connection-metadata', {
        body: {
          connectionId
        }
      });

      if (fixError) {
        console.error('❌ Erro ao corrigir metadados:', fixError);
        throw fixError;
      }

      console.log('✅ Metadados corrigidos e webhooks configurados:', fixData);
      
      const { data, error } = fixData;

      if (error) {
        console.error('❌ Erro ao configurar webhooks:', error);
        toast({
          title: "Erro ao configurar webhooks",
          description: error.message || "Ocorreu um erro ao tentar configurar os webhooks",
          variant: "destructive"
        });
        return;
      }

      console.log('✅ Webhooks configurados:', data);
      
      if (data.success) {
        setResults(data.results || []);
        setIsConfigured(true);
        
        toast({
          title: "Webhooks configurados!",
          description: `${data.message || 'Webhooks configurados com sucesso'}. Agora você receberá atualizações de status em tempo real.`,
        });
      } else {
        toast({
          title: "Erro na configuração",
          description: data.message || "Alguns webhooks falharam",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('❌ Exceção ao configurar webhooks:', error);
      toast({
        title: "Erro ao configurar webhooks",
        description: error.message || "Ocorreu um erro inesperado",
        variant: "destructive"
      });
    } finally {
      setIsConfiguring(false);
    }
  };

  const handleClose = () => {
    setResults([]);
    setIsConfigured(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Webhook className="w-5 h-5" />
            Corrigir e Configurar Z-API
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <strong>Instância:</strong> {instanceName}
            </p>
            <p className="text-sm text-muted-foreground">
              Esta ação irá corrigir os metadados da conexão e configurar todos os webhooks necessários para receber mensagens e atualizações de status em tempo real.
            </p>
          </div>

          {!isConfigured && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-medium text-sm mb-2 text-blue-900 dark:text-blue-100">
                O que será feito:
              </h4>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Atualizar metadados da conexão com credenciais Z-API</li>
                <li>Webhook de status de mensagens (enviada, entregue, lida)</li>
                <li>Webhook de mensagens recebidas</li>
                <li>Webhook de conexão e desconexão</li>
                <li>Integração com N8N (se configurado)</li>
              </ul>
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Resultados:</h4>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {results.map((result: any, index: number) => (
                  <div 
                    key={index}
                    className={`flex items-center gap-2 p-3 rounded-lg border ${
                      result.success 
                        ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
                        : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
                    }`}
                  >
                    {result.success ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 flex-shrink-0" />
                    )}
                    <div className="flex-1 text-sm">
                      <span className="font-medium capitalize">{result.type}</span>
                      {!result.success && result.error && (
                        <p className="text-xs text-muted-foreground mt-1">{result.error}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Fechar
          </Button>
          <Button 
            onClick={configureWebhooks} 
            disabled={isConfiguring || isConfigured}
          >
            {isConfiguring && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isConfigured ? 'Configurado ✓' : 'Configurar Webhooks'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
