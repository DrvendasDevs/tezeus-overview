import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, CheckCircle, XCircle, AlertTriangle, Trash2, RotateCcw } from 'lucide-react';
import { useInstanceSync, SyncResult } from '@/hooks/useInstanceSync';
import { useState } from 'react';

export const InstanceSyncPanel = () => {
  const { isSyncing, syncInstanceStatus } = useInstanceSync();
  const [results, setResults] = useState<SyncResult[]>([]);
  const [summary, setSummary] = useState<{ total: number; synced: number; deleted: number; errors: number; in_sync: number; skipped: number } | null>(null);

  const handleSync = async () => {
    const response = await syncInstanceStatus();
    if (response) {
      setResults(response.results);
      setSummary(response.summary);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'updated':
      case 'in_sync':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'deleted':
        return <Trash2 className="h-4 w-4 text-red-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'skipped':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'updated':
        return <Badge variant="outline" className="text-blue-700 border-blue-200">Atualizado</Badge>;
      case 'in_sync':
        return <Badge variant="outline" className="text-green-700 border-green-200">Sincronizado</Badge>;
      case 'deleted':
        return <Badge variant="destructive">Removido</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      case 'skipped':
        return <Badge variant="secondary">Ignorado</Badge>;
      default:
        return null;
    }
  };

  const getStatusDescription = (result: SyncResult) => {
    switch (result.status) {
      case 'updated':
        return `${result.oldStatus} → ${result.newStatus}`;
      case 'in_sync':
        return `Status atual: ${result.newStatus || 'N/A'}`;
      case 'deleted':
        return result.reason || 'Instância não encontrada na API';
      case 'error':
        return result.error || 'Erro desconhecido';
      case 'skipped':
        return result.reason || 'Credenciais não encontradas';
      default:
        return '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5" />
          Sincronizar Instâncias
        </CardTitle>
        <CardDescription>
          Verifica o status real das instâncias na API Evolution e sincroniza com o banco de dados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <RotateCcw className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800">Sincronização de Status</h4>
              <p className="text-sm text-blue-700 mt-1">
                Esta funcionalidade verifica se as conexões no sistema refletem a realidade das instâncias na API Evolution.
                Instâncias que foram deletadas diretamente na API serão marcadas como removidas no sistema.
              </p>
            </div>
          </div>
        </div>

        <Button 
          onClick={handleSync} 
          disabled={isSyncing}
          className="w-full"
        >
          {isSyncing ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Sincronizando...
            </>
          ) : (
            <>
              <RotateCcw className="h-4 w-4 mr-2" />
              Sincronizar Status das Instâncias
            </>
          )}
        </Button>

        {summary && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-800 mb-2">Resultado da Sincronização</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Total:</span>
                <span className="font-medium ml-1">{summary.total}</span>
              </div>
              <div>
                <span className="text-blue-600">Atualizados:</span>
                <span className="font-medium ml-1">{summary.synced}</span>
              </div>
              <div>
                <span className="text-green-600">Sincronizados:</span>
                <span className="font-medium ml-1">{summary.in_sync}</span>
              </div>
              <div>
                <span className="text-red-600">Removidos:</span>
                <span className="font-medium ml-1">{summary.deleted}</span>
              </div>
              <div>
                <span className="text-red-600">Erros:</span>
                <span className="font-medium ml-1">{summary.errors}</span>
              </div>
              <div>
                <span className="text-yellow-600">Ignorados:</span>
                <span className="font-medium ml-1">{summary.skipped}</span>
              </div>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Detalhes por Instância</h4>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {results.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(result.status)}
                    <div>
                      <span className="font-medium">{result.instance}</span>
                      <p className="text-xs text-gray-500">{getStatusDescription(result)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(result.status)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-sm text-gray-500">
          <p>
            <strong>Dica:</strong> Execute esta sincronização sempre que suspeitar que o status das conexões 
            não reflete a realidade das instâncias na API Evolution.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};