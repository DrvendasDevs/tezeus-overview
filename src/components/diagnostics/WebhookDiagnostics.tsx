import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';

interface DiagnosisResult {
  workspace_id: string;
  connections: {
    count: number;
    data: any[];
    error: any;
  };
  evolution_config: {
    found: boolean;
    data: any;
    error: any;
  };
  webhook_settings: {
    found: boolean;
    data: any;
    error: any;
  };
  environment: Record<string, string>;
  timestamp: string;
}

export const WebhookDiagnostics = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const { getHeaders } = useWorkspaceHeaders();

  const runDiagnosis = async () => {
    setIsRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('debug-webhook-issues', {
        headers: getHeaders()
      });

      if (error) {
        console.error('Error running diagnosis:', error);
        return;
      }

      setDiagnosis(data);
    } catch (error) {
      console.error('Error running diagnosis:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusIcon = (hasData: boolean, hasError: boolean) => {
    if (hasError) return <XCircle className="h-4 w-4 text-destructive" />;
    if (hasData) return <CheckCircle className="h-4 w-4 text-success" />;
    return <AlertTriangle className="h-4 w-4 text-warning" />;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Diagnóstico de Webhooks
        </CardTitle>
        <CardDescription>
          Diagnóstica problemas com webhooks e configurações da Evolution API
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDiagnosis} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? 'Executando diagnóstico...' : 'Executar Diagnóstico'}
        </Button>

        {diagnosis && (
          <div className="space-y-4">
            <div className="grid gap-4">
              <div className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center gap-2">
                  {getStatusIcon(diagnosis.connections.count > 0, !!diagnosis.connections.error)}
                  <span className="font-medium">Conexões</span>
                </div>
                <Badge variant="outline">
                  {diagnosis.connections.count} encontradas
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center gap-2">
                  {getStatusIcon(diagnosis.evolution_config.found, !!diagnosis.evolution_config.error)}
                  <span className="font-medium">Configuração Evolution</span>
                </div>
                <Badge variant={diagnosis.evolution_config.found ? "outline" : "destructive"}>
                  {diagnosis.evolution_config.found ? 'Configurado' : 'Não encontrado'}
                </Badge>
              </div>

              <div className="flex items-center justify-between p-3 border rounded">
                <div className="flex items-center gap-2">
                  {getStatusIcon(diagnosis.webhook_settings.found, !!diagnosis.webhook_settings.error)}
                  <span className="font-medium">Webhook N8N</span>
                </div>
                <Badge variant={diagnosis.webhook_settings.found ? "outline" : "destructive"}>
                  {diagnosis.webhook_settings.found ? 'Configurado' : 'Não encontrado'}
                </Badge>
              </div>
            </div>

            {(!diagnosis.evolution_config.found || !diagnosis.webhook_settings.found) && (
              <div className="p-4 bg-warning/10 border border-warning/20 rounded">
                <h4 className="font-medium text-warning mb-2">Problemas Identificados:</h4>
                <ul className="text-sm text-warning space-y-1">
                  {!diagnosis.evolution_config.found && (
                    <li>• Configuração da Evolution API não encontrada para este workspace</li>
                  )}
                  {!diagnosis.webhook_settings.found && (
                    <li>• Webhook do N8N não configurado para este workspace</li>
                  )}
                </ul>
              </div>
            )}

            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground">
                Ver detalhes técnicos
              </summary>
              <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto">
                {JSON.stringify(diagnosis, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
};