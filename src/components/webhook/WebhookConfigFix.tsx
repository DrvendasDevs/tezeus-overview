import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, RefreshCw, XCircle } from 'lucide-react';
import { useUpdateWebhooks } from '@/hooks/useUpdateWebhooks';
import { useState } from 'react';

export const WebhookConfigFix = () => {
  const { isUpdating, updateAllWebhooks } = useUpdateWebhooks();
  const [results, setResults] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ total: number; successful: number; failed: number } | null>(null);

  const handleUpdate = async () => {
    const response = await updateAllWebhooks();
    if (response) {
      setResults(response.results);
      setSummary(response.summary);
    }
  };

  const getStatusIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getStatusBadge = (success: boolean) => {
    return success ? (
      <Badge variant="default" className="bg-green-500">Sucesso</Badge>
    ) : (
      <Badge variant="destructive">Erro</Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Atualizar Webhooks - Habilitar Base64
        </CardTitle>
        <CardDescription>
          Atualiza todas as instâncias existentes para habilitar recebimento de mídia em base64
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
          <AlertTriangle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="text-sm text-blue-900 dark:text-blue-100">
            <p className="font-medium mb-1">Por que executar esta atualização?</p>
            <p>Esta função corrige as instâncias existentes para receber mídia (áudios, imagens, vídeos) em formato base64, permitindo que o N8N processe os arquivos sem precisar fazer download adicional.</p>
          </div>
        </div>

        <Button 
          onClick={handleUpdate} 
          disabled={isUpdating}
          className="w-full"
        >
          {isUpdating ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Atualizando...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar Todas as Instâncias
            </>
          )}
        </Button>

        {summary && (
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
            <div className="text-center">
              <p className="text-2xl font-bold">{summary.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{summary.successful}</p>
              <p className="text-xs text-muted-foreground">Sucesso</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-600">{summary.failed}</p>
              <p className="text-xs text-muted-foreground">Erros</p>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Resultados por Instância:</h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {results.map((result, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.success)}
                    <span className="font-mono text-sm">{result.instance_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(result.success)}
                    {result.status && (
                      <Badge variant="outline">Status: {result.status}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/30 rounded">
          <p className="font-medium">ℹ️ Configuração aplicada:</p>
          <ul className="list-disc list-inside space-y-0.5 ml-2">
            <li>webhook_base64: true ✅</li>
            <li>webhook_by_events: true ✅</li>
            <li>URL: evolution-webhook-v2</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
