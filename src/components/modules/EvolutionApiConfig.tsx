import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspaceHeaders } from "@/lib/workspaceHeaders";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface EvolutionApiConfigProps {
  workspaceId: string;
}

export function EvolutionApiConfig({ workspaceId }: EvolutionApiConfigProps) {
  const [evolutionUrl, setEvolutionUrl] = useState("");
  const [evolutionApiKey, setEvolutionApiKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');

  // Load current settings for selected workspace
  useEffect(() => {
    const loadConfig = async () => {
      if (!workspaceId) return;
      
      try {
        const headers = getWorkspaceHeaders(workspaceId);
        const { data, error } = await supabase.functions.invoke('get-evolution-config', {
          body: { workspaceId },
          headers
        });

        if (error) {
          console.error('❌ Error from get-evolution-config:', error);
          throw error;
        }

        if (data?.url) {
          setEvolutionUrl(data.url);
        } else {
          setEvolutionUrl('');
        }
        
        if (data?.apiKey) {
          setEvolutionApiKey(data.apiKey);
        }
      } catch (error) {
        console.error('❌ Error loading evolution config:', error);
        toast({
          title: 'Configuração não encontrada',
          description: 'Por favor, configure a URL e API Key da Evolution API',
          variant: 'destructive'
        });
      }
    };
    
    loadConfig();
  }, [workspaceId]);

  const testConnection = async () => {
    if (!evolutionUrl.trim() || !evolutionApiKey.trim()) {
      toast({
        title: 'Configuração incompleta',
        description: 'Por favor, insira URL e API Key válidas',
        variant: 'destructive'
      });
      return;
    }

    setTesting(true);
    try {
      const headers = getWorkspaceHeaders(workspaceId);
      const { data, error } = await supabase.functions.invoke('test-evolution-api', {
        body: { testUrl: evolutionUrl, testApiKey: evolutionApiKey },
        headers
      });

      if (error) throw error;

      if (data?.success) {
        setConnectionStatus('connected');
        toast({
          title: 'Conexão bem-sucedida',
          description: 'A URL da Evolution API está funcionando corretamente'
        });
      } else {
        setConnectionStatus('disconnected');
        toast({
          title: 'Falha na conexão',
          description: data?.error || 'Não foi possível conectar com a Evolution API',
          variant: 'destructive'
        });
      }
    } catch (error: any) {
      console.error('Error testing connection:', error);
      setConnectionStatus('disconnected');
      toast({
        title: 'Erro no teste',
        description: error.message || 'Erro ao testar a conexão',
        variant: 'destructive'
      });
    } finally {
      setTesting(false);
    }
  };

  const clearConfiguration = async () => {
    if (!workspaceId) return;

    setClearing(true);
    try {
      const headers = getWorkspaceHeaders(workspaceId);
      const { data, error } = await supabase.functions.invoke('clear-workspace-evolution-config', {
        body: { workspaceId },
        headers
      });

      if (error) {
        console.error('❌ Error from clear-workspace-evolution-config:', error);
        throw error;
      }

      setEvolutionUrl('');
      setEvolutionApiKey('');
      setConnectionStatus('unknown');

      toast({
        title: 'Configuração removida',
        description: 'Configuração da Evolution API foi removida. Configure novamente.'
      });
    } catch (error: any) {
      console.error('❌ Error clearing evolution config:', error);
      toast({
        title: 'Erro ao remover',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setClearing(false);
    }
  };

  const saveConfiguration = async () => {
    if (!workspaceId) return;
    if (!evolutionUrl.trim() || !evolutionApiKey.trim()) {
      toast({
        title: 'Configuração incompleta',
        description: 'Por favor, insira URL e API Key válidas',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const headers = getWorkspaceHeaders(workspaceId);
      const { data, error } = await supabase.functions.invoke('save-evolution-config', {
        body: { 
          workspaceId,
          evolutionUrl: evolutionUrl.trim(),
          evolutionApiKey: evolutionApiKey.trim()
        },
        headers
      });

      if (error) {
        console.error('❌ Error from save-evolution-config:', error);
        throw error;
      }

      toast({
        title: 'Configuração salva',
        description: 'Configuração da Evolution API atualizada com sucesso'
      });
      
      setConnectionStatus('unknown');
    } catch (error: any) {
      console.error('❌ Error saving evolution config:', error);
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <Badge variant="default" className="bg-success text-success-foreground">
            <CheckCircle className="w-4 h-4 mr-1" />
            Conectado
          </Badge>
        );
      case 'disconnected':
        return (
          <Badge variant="destructive">
            <XCircle className="w-4 h-4 mr-1" />
            Desconectado
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            Status desconhecido
          </Badge>
        );
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Configuração da Evolution API</CardTitle>
            <CardDescription>
              Configure a URL e API Key da Evolution API para esta empresa
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="evolution-url">URL da Evolution API</Label>
            <Input
              id="evolution-url"
              type="url"
              value={evolutionUrl}
              onChange={(e) => setEvolutionUrl(e.target.value)}
              placeholder="https://your-evolution-api.com"
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              Insira a URL completa da sua instância da Evolution API (ex: https://api.exemplo.com)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="evolution-api-key">API Key da Evolution API</Label>
            <Input
              id="evolution-api-key"
              type="password"
              value={evolutionApiKey}
              onChange={(e) => setEvolutionApiKey(e.target.value)}
              placeholder="Sua API Key da Evolution API"
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              Insira a API Key para autenticação na Evolution API
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button 
            onClick={saveConfiguration} 
            disabled={loading || !evolutionUrl.trim() || !evolutionApiKey.trim()}
            className="flex-1"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Salvar Configuração
          </Button>
          
          <Button 
            variant="outline" 
            onClick={testConnection}
            disabled={testing || !evolutionUrl.trim() || !evolutionApiKey.trim()}
          >
            {testing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Testar Conexão
          </Button>

          <Button 
            variant="destructive" 
            onClick={clearConfiguration}
            disabled={clearing}
          >
            {clearing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Limpar
          </Button>
        </div>

        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="text-sm font-medium mb-2">Informações importantes:</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Esta configuração é específica para esta empresa</li>
            <li>• Todas as conexões Evolution desta empresa usarão esta URL e API Key</li>
            <li>• Teste a conexão antes de salvar para verificar se as credenciais estão corretas</li>
            <li>• A API Key é armazenada de forma segura no banco de dados</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
