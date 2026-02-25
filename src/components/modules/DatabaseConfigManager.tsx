import { useState, useEffect } from 'react';
import { useDatabaseConfig, DatabaseConfig } from '@/hooks/useDatabaseConfig';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { Database, RefreshCw, TestTube, Eye, EyeOff, Save } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function DatabaseConfigManager() {
  const {
    config,
    loading,
    error,
    refreshConfig,
    updateConfig,
    testConnection,
    isTesting,
  } = useDatabaseConfig();

  const { hasRole } = useAuth();
  const isMaster = hasRole(['master']);

  const [editForm, setEditForm] = useState<Partial<DatabaseConfig>>({});
  const [showAnonKey, setShowAnonKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Carregar dados no formulário quando a configuração for carregada
  useEffect(() => {
    if (config) {
      setEditForm({
        name: config.name || '',
        url: config.url || '',
        projectId: config.projectId || '',
        anonKey: config.anonKey || '',
      });
    } else {
      // Se não há configuração, inicializar formulário vazio para permitir criar
      setEditForm({
        name: '',
        url: '',
        projectId: '',
        anonKey: '',
      });
    }
  }, [config]);

  // Salvar configuração
  const handleSave = async () => {
    // Validar campos obrigatórios
    if (!editForm.url || !editForm.anonKey || !editForm.projectId) {
      return;
    }

    setIsSaving(true);
    try {
      if (config) {
        // Atualizar configuração existente
        const success = await updateConfig(config.id, editForm);
        if (success) {
          // Recarregar página após salvar para aplicar mudanças
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        }
      } else {
        // Criar nova configuração via hook
        // A criação será feita pelo refreshConfig que cria automaticamente se não existir
        await refreshConfig();
        // Recarregar página após criar para aplicar mudanças
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      }
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Testar conexão
  const handleTestConnection = async () => {
    // Validar campos obrigatórios
    if (!editForm.url || !editForm.anonKey) {
      return;
    }
    
    // Usar dados do formulário para testar (mesmo que não tenha config salva)
    const testConfig: DatabaseConfig = {
      id: config?.id || 'temp',
      name: editForm.name || 'Teste',
      url: editForm.url!,
      anonKey: editForm.anonKey!,
      projectId: editForm.projectId || '',
    };
    
    await testConnection(testConfig);
  };

  if (!isMaster) {
    return (
      <Card className="bg-white dark:bg-[#1f1f1f] border-[#d4d4d4] dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-800 dark:text-gray-200">Acesso Negado</CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Apenas usuários master podem gerenciar configurações de banco de dados.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6 text-gray-800 dark:text-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Configuração de Banco de Dados</h2>
          <p className="text-muted-foreground dark:text-gray-400">
            Configure as credenciais do banco de dados Supabase. Esta configuração é GLOBAL e afeta todos os usuários.
          </p>
        </div>
        <Button 
          onClick={refreshConfig} 
          variant="outline" 
          size="sm" 
          disabled={loading}
          className="border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d] text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#3d3d3d]"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {error && (
        <Card className="border-destructive bg-white dark:bg-[#1f1f1f] border-[#d4d4d4] dark:border-gray-700">
          <CardContent className="pt-6">
            <p className="text-destructive dark:text-red-400 font-semibold mb-2">Erro ao carregar configuração:</p>
            <p className="text-destructive dark:text-red-400 text-sm mb-4">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={refreshConfig}
              disabled={loading}
              className="border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d] text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#3d3d3d]"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Tentar Novamente
            </Button>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card className="bg-white dark:bg-[#1f1f1f] border-[#d4d4d4] dark:border-gray-700">
          <CardHeader>
            <Skeleton className="h-6 w-48 bg-gray-200 dark:bg-gray-700" />
            <Skeleton className="h-4 w-64 mt-2 bg-gray-200 dark:bg-gray-700" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-10 w-full bg-gray-200 dark:bg-gray-700" />
              <Skeleton className="h-10 w-full bg-gray-200 dark:bg-gray-700" />
              <Skeleton className="h-10 w-full bg-gray-200 dark:bg-gray-700" />
              <Skeleton className="h-10 w-full bg-gray-200 dark:bg-gray-700" />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-white dark:bg-[#1f1f1f] border-[#d4d4d4] dark:border-gray-700">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Database className="h-5 w-5 text-gray-700 dark:text-gray-300" />
              <CardTitle className="text-gray-800 dark:text-gray-200">Credenciais do Banco de Dados</CardTitle>
            </div>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              {config 
                ? 'Configure as credenciais do Supabase. Após salvar, a página será recarregada para aplicar as mudanças.'
                : 'Configure as credenciais do Supabase. Uma nova configuração será criada ao salvar.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name" className="text-gray-700 dark:text-gray-300">Nome</Label>
              <Input
                id="name"
                value={editForm.name || ''}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Configuração Principal"
                className="bg-white dark:bg-[#2d2d2d] border-[#d4d4d4] dark:border-gray-700 text-gray-800 dark:text-gray-200"
              />
              <p className="text-xs text-muted-foreground dark:text-gray-400 mt-1">
                Nome identificador para esta configuração.
              </p>
            </div>

            <div>
              <Label htmlFor="url" className="text-gray-700 dark:text-gray-300">URL do Supabase</Label>
              <Input
                id="url"
                value={editForm.url || ''}
                onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                placeholder="https://projeto.supabase.co"
                className="bg-white dark:bg-[#2d2d2d] border-[#d4d4d4] dark:border-gray-700 text-gray-800 dark:text-gray-200"
              />
              <p className="text-xs text-muted-foreground dark:text-gray-400 mt-1">
                URL completa do projeto Supabase.
              </p>
            </div>

            <div>
              <Label htmlFor="project-id" className="text-gray-700 dark:text-gray-300">Project ID</Label>
              <Input
                id="project-id"
                value={editForm.projectId || ''}
                onChange={(e) => setEditForm({ ...editForm, projectId: e.target.value })}
                placeholder="projeto-id"
                className="bg-white dark:bg-[#2d2d2d] border-[#d4d4d4] dark:border-gray-700 text-gray-800 dark:text-gray-200"
              />
              <p className="text-xs text-muted-foreground dark:text-gray-400 mt-1">
                ID do projeto no Supabase.
              </p>
            </div>

            <div>
              <Label htmlFor="anon-key" className="text-gray-700 dark:text-gray-300">Anon Key</Label>
              <div className="relative">
                <Input
                  id="anon-key"
                  type={showAnonKey ? 'text' : 'password'}
                  value={editForm.anonKey || ''}
                  onChange={(e) => setEditForm({ ...editForm, anonKey: e.target.value })}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="pr-10 bg-white dark:bg-[#2d2d2d] border-[#d4d4d4] dark:border-gray-700 text-gray-800 dark:text-gray-200"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent dark:hover:bg-transparent"
                  onClick={() => setShowAnonKey(!showAnonKey)}
                >
                  {showAnonKey ? (
                    <EyeOff className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground dark:text-gray-400 mt-1">
                Chave pública (anon key) do Supabase. Necessária para conexão.
              </p>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSave}
                disabled={isSaving || !editForm.url || !editForm.anonKey || !editForm.projectId}
                className="flex-1 bg-primary dark:bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    {config ? 'Salvar Configuração' : 'Criar Configuração'}
                  </>
                )}
              </Button>
              <Button
                onClick={handleTestConnection}
                variant="outline"
                disabled={isTesting || !editForm.url || !editForm.anonKey}
                className="border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d] text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#3d3d3d] disabled:opacity-50"
              >
                {isTesting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Testar Conexão
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
