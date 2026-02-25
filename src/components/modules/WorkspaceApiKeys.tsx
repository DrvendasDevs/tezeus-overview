import { useState, useEffect } from "react";
import { Key, Plus, Trash2, Eye, EyeOff, Copy, Check, AlertCircle, BookOpen, Code, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaceHeaders } from "@/lib/workspaceHeaders";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSupabaseFunctionUrl } from "@/lib/config";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pipeline, PipelineColumn } from "@/hooks/usePipelines";
import { useQueues } from "@/hooks/useQueues";

interface ApiKey {
  id: string;
  workspace_id: string;
  api_key: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
}


export function WorkspaceApiKeys() {
  const { selectedWorkspace } = useWorkspace();
  const { getHeaders } = useWorkspaceHeaders();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<ApiKey | null>(null);

  // Estados para Payload Personalizado
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [selectedColumnId, setSelectedColumnId] = useState<string>("");
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [selectedQueueId, setSelectedQueueId] = useState<string>("");
  
  // Estados para Tags e Conversa
  const [tags, setTags] = useState<Array<{ id: string; name: string; color: string }>>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [initialMessage, setInitialMessage] = useState<string>("");
  const [createConversation, setCreateConversation] = useState<boolean>(false);

  const apiUrl = getSupabaseFunctionUrl("external-webhook-api");

  // Filas do workspace para o payload personalizado
  const { queues, loading: loadingQueues } = useQueues(selectedWorkspace?.workspace_id);

  useEffect(() => {
    if (selectedWorkspace) {
      loadApiKeys();
      loadPipelines();
      loadTags();
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    if (selectedPipelineId && selectedWorkspace) {
      loadColumns(selectedPipelineId);
    } else {
      setColumns([]);
      setSelectedColumnId("");
    }
  }, [selectedPipelineId, selectedWorkspace]);

  const loadApiKeys = async () => {
    if (!selectedWorkspace) return;

    try {
      setLoading(true);
      const headers = getHeaders();

      const { data, error } = await supabase.functions.invoke("manage-workspace-api-keys", {
        body: {
          action: "list",
          workspace_id: selectedWorkspace.workspace_id,
        },
        headers,
      });

      if (error) throw error;

      setApiKeys(data?.data || []);
    } catch (error: any) {
      console.error("Erro ao carregar API Keys:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar API Keys",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!selectedWorkspace || !newKeyName.trim()) {
      toast({
        title: "Erro",
        description: "Nome da chave é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);
      const headers = getHeaders();

      const { data, error } = await supabase.functions.invoke("manage-workspace-api-keys", {
        body: {
          action: "create",
          workspace_id: selectedWorkspace.workspace_id,
          name: newKeyName.trim(),
        },
        headers,
      });

      if (error) throw error;

      setNewKeyValue(data?.data?.api_key || null);
      setNewKeyName("");
      setShowNewKey(false);
      await loadApiKeys();

      toast({
        title: "Sucesso",
        description: "API Key criada com sucesso! Copie a chave agora, pois ela não será exibida novamente.",
      });
    } catch (error: any) {
      console.error("Erro ao criar API Key:", error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao criar API Key",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (key: ApiKey) => {
    try {
      setLoading(true);
      const headers = getHeaders();

      const { error } = await supabase.functions.invoke("manage-workspace-api-keys", {
        body: {
          action: "update",
          workspace_id: selectedWorkspace?.workspace_id,
          api_key_id: key.id,
          is_active: !key.is_active,
        },
        headers,
      });

      if (error) throw error;

      await loadApiKeys();
      toast({
        title: "Sucesso",
        description: `API Key ${!key.is_active ? "ativada" : "desativada"} com sucesso`,
      });
    } catch (error: any) {
      console.error("Erro ao atualizar API Key:", error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar API Key",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKey = async () => {
    if (!keyToDelete || !selectedWorkspace) return;

    try {
      setLoading(true);
      const headers = getHeaders();

      const { error } = await supabase.functions.invoke("manage-workspace-api-keys", {
        body: {
          action: "delete",
          workspace_id: selectedWorkspace.workspace_id,
          api_key_id: keyToDelete.id,
        },
        headers,
      });

      if (error) throw error;

      await loadApiKeys();
      setDeleteDialogOpen(false);
      setKeyToDelete(null);

      toast({
        title: "Sucesso",
        description: "API Key deletada com sucesso",
      });
    } catch (error: any) {
      console.error("Erro ao deletar API Key:", error);
      toast({
        title: "Erro",
        description: "Erro ao deletar API Key",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleKeyVisibility = (keyId: string) => {
    const newVisible = new Set(visibleKeys);
    if (newVisible.has(keyId)) {
      newVisible.delete(keyId);
    } else {
      newVisible.add(keyId);
    }
    setVisibleKeys(newVisible);
  };

  const copyToClipboard = async (text: string, keyId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(keyId);
      toast({
        title: "Copiado",
        description: "API Key copiada para a área de transferência",
      });
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao copiar para a área de transferência",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Nunca";
    return new Date(dateString).toLocaleString("pt-BR");
  };

  const loadPipelines = async () => {
    if (!selectedWorkspace) return;

    try {
      setLoadingPipelines(true);
      const headers = getHeaders();

      const { data, error } = await supabase.functions.invoke("pipeline-management/pipelines", {
        method: "GET",
        headers,
      });

      if (error) throw error;

      setPipelines(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar pipelines:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar pipelines",
        variant: "destructive",
      });
    } finally {
      setLoadingPipelines(false);
    }
  };

  const loadColumns = async (pipelineId: string) => {
    if (!selectedWorkspace || !pipelineId) return;

    try {
      setLoadingColumns(true);
      const headers = getHeaders();

      const { data, error } = await supabase.functions.invoke(
        `pipeline-management/columns?pipeline_id=${pipelineId}`,
        {
          method: "GET",
          headers,
        }
      );

      if (error) throw error;

      setColumns(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar colunas:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar colunas",
        variant: "destructive",
      });
    } finally {
      setLoadingColumns(false);
    }
  };

  const loadTags = async () => {
    if (!selectedWorkspace) return;

    try {
      setLoadingTags(true);
      const { data, error } = await supabase
        .from("tags")
        .select("id, name, color")
        .eq("workspace_id", selectedWorkspace.workspace_id)
        .order("name");

      if (error) throw error;

      setTags(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar tags:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar tags",
        variant: "destructive",
      });
    } finally {
      setLoadingTags(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  };

  const generatePayload = () => {
    if (!selectedWorkspace || !selectedPipelineId || !selectedColumnId) {
      return null;
    }

    const payload: any = {
      action: "create_contact_with_card",
      workspace_id: selectedWorkspace.workspace_id,
      contact: {
        name: "Nome do Cliente",
        phone: "5511999999999",
        email: "email@exemplo.com",
      },
      card: {
        pipeline_id: selectedPipelineId,
        column_id: selectedColumnId,
        description: "Descrição do negócio",
        value: 0,
      },
    };

    // Adicionar fila se selecionada
    if (selectedQueueId) {
      payload.card.queue_id = selectedQueueId;
    }

    // Adicionar tags se selecionadas
    if (selectedTagIds.length > 0) {
      payload.contact.tags = selectedTagIds;
    }

    // Adicionar conversa se solicitado
    if (createConversation) {
      payload.conversation = {
        create: true,
      };
      
      // Adicionar mensagem inicial se fornecida
      if (initialMessage.trim()) {
        payload.conversation.initial_message = initialMessage.trim();
      }
    }

    return JSON.stringify(payload, null, 2);
  };

  const copyPayload = async () => {
    const payload = generatePayload();
    if (!payload) {
      toast({
        title: "Erro",
        description: "Selecione pipeline e coluna para gerar o payload",
        variant: "destructive",
      });
      return;
    }

    try {
      await navigator.clipboard.writeText(payload);
      setCopiedPayload(true);
      toast({
        title: "Copiado",
        description: "Payload copiado para a área de transferência",
      });
      setTimeout(() => setCopiedPayload(false), 2000);
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao copiar payload",
        variant: "destructive",
      });
    }
  };

  if (!selectedWorkspace) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Selecione um workspace para gerenciar API Keys
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="bg-white dark:bg-[#1f1f1f] border border-[#d4d4d4] dark:border-gray-700 shadow-sm flex flex-col h-full overflow-hidden">
        <Tabs defaultValue="keys" className="w-full flex flex-col h-full overflow-hidden">
          <TabsList className="grid w-full grid-cols-3 bg-[#f3f3f3] dark:bg-[#2d2d2d] rounded-none h-auto p-0 border-b border-[#d4d4d4] dark:border-gray-700">
            <TabsTrigger
              value="keys"
              className="rounded-none py-3 px-6 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-[#FEF3C7] dark:data-[state=active]:bg-gray-700 data-[state=active]:text-black dark:data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-gray-300 dark:data-[state=active]:border-gray-600 data-[state=active]:shadow-none"
            >
              API Keys
            </TabsTrigger>
            <TabsTrigger
              value="documentation"
              className="rounded-none py-3 px-6 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-[#FEF3C7] dark:data-[state=active]:bg-gray-700 data-[state=active]:text-black dark:data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-gray-300 dark:data-[state=active]:border-gray-600 data-[state=active]:shadow-none"
            >
              Documentação
            </TabsTrigger>
            <TabsTrigger
              value="payload-generator"
              className="rounded-none py-3 px-6 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-[#FEF3C7] dark:data-[state=active]:bg-gray-700 data-[state=active]:text-black dark:data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-gray-300 dark:data-[state=active]:border-gray-600 data-[state=active]:shadow-none"
            >
              Payload Personalizado
            </TabsTrigger>
          </TabsList>

          <TabsContent value="keys" className="p-6 mt-0 bg-white dark:bg-[#1f1f1f] overflow-y-auto flex-1">
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[#d4d4d4] dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <Key className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  <div>
                    <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                      Gerenciamento de API Keys
                    </h2>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      Gerencie as chaves de API para integrações externas
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    setShowNewKey(true);
                    setNewKeyValue(null);
                  }}
                  size="sm"
                  className="h-8 px-3 text-xs rounded-none"
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Nova API Key
                </Button>
              </div>

              {/* New Key Form */}
              {showNewKey && (
                <Card className="border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1f1f1f]">
                  <CardHeader className="bg-white dark:bg-[#1f1f1f]">
                    <CardTitle className="text-sm text-gray-800 dark:text-gray-200">Criar Nova API Key</CardTitle>
                    <CardDescription className="text-xs text-gray-600 dark:text-gray-400">
                      Dê um nome descritivo para identificar esta chave
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 bg-white dark:bg-[#1f1f1f]">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Nome da Chave</Label>
                      <Input
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="Ex: Integração N8N, Sistema ERP, etc."
                        className="h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d] text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                        disabled={loading}
                      />
                    </div>
                    {newKeyValue && (
                      <div className="space-y-2 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                        <Label className="text-xs font-medium text-yellow-800 dark:text-yellow-200">
                          Sua API Key (copie agora, ela não será exibida novamente)
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            value={newKeyValue}
                            readOnly
                            className="h-8 text-xs font-mono rounded-none bg-white dark:bg-[#2d2d2d] border-[#d4d4d4] dark:border-gray-700 text-gray-900 dark:text-gray-100"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(newKeyValue, "new")}
                            className="h-8 px-3 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            {copiedKey === "new" ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button
                        onClick={handleCreateKey}
                        disabled={loading || !newKeyName.trim()}
                        size="sm"
                        className="h-8 px-3 text-xs rounded-none bg-primary text-primary-foreground hover:bg-primary/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90"
                      >
                        Criar
                      </Button>
                      <Button
                        onClick={() => {
                          setShowNewKey(false);
                          setNewKeyName("");
                          setNewKeyValue(null);
                        }}
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* API Keys List */}
              {loading && apiKeys.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Carregando...</p>
                </div>
              ) : apiKeys.length === 0 ? (
                <div className="text-center py-12">
                  <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    Nenhuma API Key criada ainda
                  </p>
                  <Button
                    onClick={() => setShowNewKey(true)}
                    size="sm"
                    className="h-8 px-3 text-xs rounded-none"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Criar Primeira API Key
                  </Button>
                </div>
              ) : (
                <div className="border border-[#d4d4d4] dark:border-gray-700 rounded-none">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#f3f3f3] dark:bg-[#2d2d2d]">
                        <TableHead className="text-xs font-semibold">Nome</TableHead>
                        <TableHead className="text-xs font-semibold">API Key</TableHead>
                        <TableHead className="text-xs font-semibold">Status</TableHead>
                        <TableHead className="text-xs font-semibold">Criada em</TableHead>
                        <TableHead className="text-xs font-semibold">Último uso</TableHead>
                        <TableHead className="text-xs font-semibold text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {apiKeys.map((key) => (
                        <TableRow key={key.id}>
                          <TableCell className="text-xs">{key.name}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <code className="text-xs font-mono bg-[#f3f3f3] dark:bg-[#2d2d2d] px-2 py-1 rounded">
                                {visibleKeys.has(key.id)
                                  ? key.api_key
                                  : `${key.api_key.substring(0, 12)}...`}
                              </code>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleKeyVisibility(key.id)}
                                className="h-6 w-6 p-0"
                              >
                                {visibleKeys.has(key.id) ? (
                                  <EyeOff className="w-3 h-3" />
                                ) : (
                                  <Eye className="w-3 h-3" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(key.api_key, key.id)}
                                className="h-6 w-6 p-0"
                              >
                                {copiedKey === key.id ? (
                                  <Check className="w-3 h-3 text-green-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={key.is_active ? "default" : "secondary"}
                              className="text-xs"
                            >
                              {key.is_active ? "Ativa" : "Inativa"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-gray-600 dark:text-gray-400">
                            {formatDate(key.created_at)}
                          </TableCell>
                          <TableCell className="text-xs text-gray-600 dark:text-gray-400">
                            {formatDate(key.last_used_at)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleActive(key)}
                                disabled={loading}
                                className="h-7 px-2 text-xs rounded-none"
                              >
                                {key.is_active ? "Desativar" : "Ativar"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setKeyToDelete(key);
                                  setDeleteDialogOpen(true);
                                }}
                                disabled={loading}
                                className="h-7 px-2 text-xs rounded-none text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="documentation" className="p-6 mt-0 bg-white dark:bg-[#1f1f1f] overflow-y-auto flex-1">
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="flex items-center gap-3 pb-4 border-b border-[#d4d4d4] dark:border-gray-700">
                <BookOpen className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                <div>
                  <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                    Documentação da API
                  </h2>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Guia completo de uso da API de Webhooks
                  </p>
                </div>
              </div>

              {/* Endpoint */}
              <Card className="border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1f1f1f]">
                <CardHeader className="bg-white dark:bg-[#1f1f1f]">
                  <CardTitle className="text-sm flex items-center gap-2 text-gray-800 dark:text-gray-200">
                    <Code className="w-4 h-4 text-gray-700 dark:text-gray-300" />
                    Endpoint
                  </CardTitle>
                </CardHeader>
                <CardContent className="bg-white dark:bg-[#1f1f1f]">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">URL Base</Label>
                    <code className="block text-xs font-mono bg-[#f3f3f3] dark:bg-[#2d2d2d] p-3 rounded border border-[#d4d4d4] dark:border-gray-700 text-gray-900 dark:text-gray-100">
                      {apiUrl}
                    </code>
                  </div>
                </CardContent>
              </Card>

              {/* Autenticação */}
              <Card className="border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1f1f1f]">
                <CardHeader className="bg-white dark:bg-[#1f1f1f]">
                  <CardTitle className="text-sm text-gray-800 dark:text-gray-200">Autenticação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 bg-white dark:bg-[#1f1f1f]">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Todas as requisições devem incluir o header <code className="bg-[#f3f3f3] dark:bg-[#2d2d2d] px-1 rounded text-gray-900 dark:text-gray-100">X-API-Key</code> com sua API Key.
                  </p>
                  <div className="bg-[#f3f3f3] dark:bg-[#2d2d2d] p-3 rounded border border-[#d4d4d4] dark:border-gray-700">
                    <code className="text-xs font-mono text-gray-900 dark:text-gray-100">
                      X-API-Key: tez_xxxxxxxxxxxxxxxxxxxxx
                    </code>
                  </div>
                </CardContent>
              </Card>

              {/* Ações */}
              <Card className="border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1f1f1f]">
                <CardHeader className="bg-white dark:bg-[#1f1f1f]">
                  <CardTitle className="text-sm text-gray-800 dark:text-gray-200">Ações Disponíveis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6 bg-white dark:bg-[#1f1f1f]">
                  {/* Create Contact */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase text-gray-800 dark:text-gray-200">1. Criar Contato</h3>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Request</Label>
                      <pre className="text-xs bg-[#f3f3f3] dark:bg-[#2d2d2d] p-3 rounded border border-[#d4d4d4] dark:border-gray-700 overflow-x-auto text-gray-900 dark:text-gray-100">
{`POST ${apiUrl}
Content-Type: application/json
X-API-Key: sua_api_key_aqui

{
  "action": "create_contact",
  "workspace_id": "uuid-do-workspace",
  "contact": {
    "name": "Nome do Cliente",
    "phone": "5511999999999",
    "email": "email@exemplo.com",
    "tags": ["uuid-tag-1", "uuid-tag-2"],
    "extra_info": {
      "campo_customizado": "valor"
    }
  },
  "conversation": {
    "create": true,
    "connection_id": "uuid-da-conexao",
    "initial_message": "Olá! Bem-vindo..."
  }
}`}
                      </pre>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Response (Sucesso)</Label>
                      <pre className="text-xs bg-[#f3f3f3] dark:bg-[#2d2d2d] p-3 rounded border border-[#d4d4d4] dark:border-gray-700 overflow-x-auto text-gray-900 dark:text-gray-100">
{`{
  "success": true,
  "data": {
    "contact_id": "uuid-gerado",
    "conversation_id": "uuid-gerado"
  },
  "message": "Contato criado com sucesso"
}`}
                      </pre>
                      <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                        Nota: <code className="bg-[#f3f3f3] dark:bg-[#2d2d2d] px-1 rounded">tags</code> é um array opcional de tag_ids (UUIDs). <code className="bg-[#f3f3f3] dark:bg-[#2d2d2d] px-1 rounded">conversation</code> é opcional e permite criar uma conversa vazia ou com mensagem inicial.
                      </p>
                    </div>
                  </div>

                  {/* Create Card */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase text-gray-800 dark:text-gray-200">2. Criar Card no Pipeline</h3>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Request</Label>
                      <pre className="text-xs bg-[#f3f3f3] dark:bg-[#2d2d2d] p-3 rounded border border-[#d4d4d4] dark:border-gray-700 overflow-x-auto text-gray-900 dark:text-gray-100">
{`POST ${apiUrl}
Content-Type: application/json
X-API-Key: sua_api_key_aqui

{
  "action": "create_card",
  "workspace_id": "uuid-do-workspace",
  "card": {
    "pipeline_id": "uuid-do-pipeline",
    "column_id": "uuid-da-coluna",
    "contact_id": "uuid-do-contato",
    "description": "Descrição do Negócio",
    "value": 1500.00,
    "status": "aberto",
    "responsible_user_id": "uuid-do-responsavel"
  }
}`}
                      </pre>
                      <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                        Nota: Você pode usar <code className="bg-[#f3f3f3] dark:bg-[#2d2d2d] px-1 rounded">title</code> no payload (será convertido para <code className="bg-[#f3f3f3] dark:bg-[#2d2d2d] px-1 rounded">description</code>), ou usar <code className="bg-[#f3f3f3] dark:bg-[#2d2d2d] px-1 rounded">description</code> diretamente.
                      </p>
                    </div>
                  </div>

                  {/* Create Contact with Card */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase text-gray-800 dark:text-gray-200">3. Criar Contato e Card Simultaneamente</h3>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Request</Label>
                      <pre className="text-xs bg-[#f3f3f3] dark:bg-[#2d2d2d] p-3 rounded border border-[#d4d4d4] dark:border-gray-700 overflow-x-auto text-gray-900 dark:text-gray-100">
{`POST ${apiUrl}
Content-Type: application/json
X-API-Key: sua_api_key_aqui

{
  "action": "create_contact_with_card",
  "workspace_id": "uuid-do-workspace",
  "contact": {
    "name": "Nome do Cliente",
    "phone": "5511999999999",
    "email": "email@exemplo.com",
    "tags": ["uuid-tag-1", "uuid-tag-2"]
  },
  "card": {
    "pipeline_id": "uuid-do-pipeline",
    "column_id": "uuid-da-coluna",
    "description": "Novo Negócio",
    "value": 2000.00
  },
  "conversation": {
    "create": true,
    "connection_id": "uuid-da-conexao",
    "initial_message": "Olá! Bem-vindo..."
  }
}`}
                      </pre>
                      <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                        Nota: Você pode usar <code className="bg-[#f3f3f3] dark:bg-[#2d2d2d] px-1 rounded">title</code> no payload (será convertido para <code className="bg-[#f3f3f3] dark:bg-[#2d2d2d] px-1 rounded">description</code>), ou usar <code className="bg-[#f3f3f3] dark:bg-[#2d2d2d] px-1 rounded">description</code> diretamente. <code className="bg-[#f3f3f3] dark:bg-[#2d2d2d] px-1 rounded">tags</code> é opcional (array de tag_ids). <code className="bg-[#f3f3f3] dark:bg-[#2d2d2d] px-1 rounded">conversation</code> é opcional e permite criar conversa vazia ou com mensagem inicial.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Response (Sucesso)</Label>
                      <pre className="text-xs bg-[#f3f3f3] dark:bg-[#2d2d2d] p-3 rounded border border-[#d4d4d4] dark:border-gray-700 overflow-x-auto text-gray-900 dark:text-gray-100">
{`{
  "success": true,
  "data": {
    "contact_id": "uuid-gerado",
    "card_id": "uuid-gerado",
    "conversation_id": "uuid-gerado"
  },
  "message": "Contato e card criados com sucesso"
}`}
                      </pre>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Observações */}
              <Card className="border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1f1f1f]">
                <CardHeader className="bg-white dark:bg-[#1f1f1f]">
                  <CardTitle className="text-sm text-gray-800 dark:text-gray-200">Observações Importantes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 bg-white dark:bg-[#1f1f1f]">
                  <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-400 list-disc list-inside">
                    <li>O campo <code className="bg-[#f3f3f3] dark:bg-[#2d2d2d] px-1 rounded text-gray-900 dark:text-gray-100">phone</code> é opcional, mas se fornecido, será normalizado (adiciona 55 se necessário)</li>
                    <li>Contatos duplicados (mesmo telefone no mesmo workspace) retornam o contato existente sem criar novo</li>
                    <li>O campo <code className="bg-[#f3f3f3] dark:bg-[#2d2d2d] px-1 rounded text-gray-900 dark:text-gray-100">tags</code> é opcional e aceita um array de tag_ids (UUIDs). As tags devem pertencer ao workspace</li>
                    <li>O campo <code className="bg-[#f3f3f3] dark:bg-[#2d2d2d] px-1 rounded text-gray-900 dark:text-gray-100">conversation</code> é opcional. Se <code className="bg-[#f3f3f3] dark:bg-[#2d2d2d] px-1 rounded text-gray-900 dark:text-gray-100">create: true</code>, cria uma conversa. <code className="bg-[#f3f3f3] dark:bg-[#2d2d2d] px-1 rounded text-gray-900 dark:text-gray-100">connection_id</code> é opcional (usa conexão padrão se não fornecido). <code className="bg-[#f3f3f3] dark:bg-[#2d2d2d] px-1 rounded text-gray-900 dark:text-gray-100">initial_message</code> é opcional e adiciona uma mensagem inicial à conversa</li>
                    <li>Para cards, use o campo <code className="bg-[#f3f3f3] dark:bg-[#2d2d2d] px-1 rounded text-gray-900 dark:text-gray-100">description</code> (obrigatório). Você também pode usar <code className="bg-[#f3f3f3] dark:bg-[#2d2d2d] px-1 rounded text-gray-900 dark:text-gray-100">title</code> no payload - ele será automaticamente convertido para <code className="bg-[#f3f3f3] dark:bg-[#2d2d2d] px-1 rounded text-gray-900 dark:text-gray-100">description</code></li>
                    <li>O status padrão dos cards é <code className="bg-[#f3f3f3] dark:bg-[#2d2d2d] px-1 rounded text-gray-900 dark:text-gray-100">"aberto"</code></li>
                    <li>O valor padrão dos cards é <code className="bg-[#f3f3f3] dark:bg-[#2d2d2d] px-1 rounded text-gray-900 dark:text-gray-100">0</code></li>
                    <li>Todas as requisições são registradas em logs para auditoria</li>
                  </ul>
                </CardContent>
              </Card>

              {/* Códigos de Erro */}
              <Card className="border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1f1f1f]">
                <CardHeader className="bg-white dark:bg-[#1f1f1f]">
                  <CardTitle className="text-sm text-gray-800 dark:text-gray-200">Códigos de Erro</CardTitle>
                </CardHeader>
                <CardContent className="bg-white dark:bg-[#1f1f1f]">
                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <Badge variant="destructive" className="text-xs">401</Badge>
                      <div className="text-gray-700 dark:text-gray-300">
                        <strong className="text-gray-900 dark:text-gray-100">UNAUTHORIZED</strong> - API Key inválida ou não fornecida
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="destructive" className="text-xs">403</Badge>
                      <div className="text-gray-700 dark:text-gray-300">
                        <strong className="text-gray-900 dark:text-gray-100">FORBIDDEN</strong> - API Key não tem permissão para o workspace
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="destructive" className="text-xs">404</Badge>
                      <div className="text-gray-700 dark:text-gray-300">
                        <strong className="text-gray-900 dark:text-gray-100">WORKSPACE_NOT_FOUND</strong> - Workspace não encontrado
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Badge variant="destructive" className="text-xs">400</Badge>
                      <div className="text-gray-700 dark:text-gray-300">
                        <strong className="text-gray-900 dark:text-gray-100">MISSING_*</strong> - Campos obrigatórios ausentes
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="payload-generator" className="p-6 mt-0 bg-white dark:bg-[#1f1f1f] overflow-y-auto flex-1">
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="flex items-center gap-3 pb-4 border-b border-[#d4d4d4] dark:border-gray-700">
                <Code className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                <div>
                  <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                    Gerador de Payload Personalizado
                  </h2>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                    Selecione pipeline e coluna para gerar um payload com os IDs corretos
                  </p>
                </div>
              </div>

              <Card className="border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1f1f1f]">
                <CardHeader className="bg-white dark:bg-[#1f1f1f]">
                  <CardTitle className="text-sm text-gray-800 dark:text-gray-200">Seleção de Pipeline e Coluna</CardTitle>
                  <CardDescription className="text-xs text-gray-600 dark:text-gray-400">
                    Escolha o pipeline e a coluna para gerar o payload
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 bg-white dark:bg-[#1f1f1f]">
                  {/* Workspace (readonly) */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Workspace</Label>
                    <Input
                      value={selectedWorkspace?.name || ""}
                      disabled
                      className="h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 bg-[#f3f3f3] dark:bg-[#2d2d2d] text-gray-600 dark:text-gray-400 cursor-not-allowed"
                    />
                  </div>

                  {/* Pipeline Select */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Pipeline</Label>
                    <Select
                      value={selectedPipelineId}
                      onValueChange={setSelectedPipelineId}
                      disabled={loadingPipelines || pipelines.length === 0}
                    >
                      <SelectTrigger className="h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d] text-gray-900 dark:text-gray-100">
                        <SelectValue
                          placeholder={
                            loadingPipelines
                              ? "Carregando pipelines..."
                              : pipelines.length === 0
                              ? "Nenhum pipeline disponível"
                              : "Selecione um pipeline"
                          }
                        />
                      </SelectTrigger>
                      {pipelines.length > 0 && (
                        <SelectContent className="dark:bg-[#2d2d2d] dark:border-gray-700">
                          {pipelines.map((pipeline) => (
                            <SelectItem
                              key={pipeline.id}
                              value={pipeline.id}
                              className="text-xs dark:text-gray-200 dark:focus:bg-gray-700"
                            >
                              {pipeline.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      )}
                    </Select>
                  </div>

                    {/* Column Select */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Etapa</Label>
                    <Select
                      value={selectedColumnId}
                      onValueChange={setSelectedColumnId}
                      disabled={!selectedPipelineId || loadingColumns || columns.length === 0}
                    >
                      <SelectTrigger className="h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d] text-gray-900 dark:text-gray-100">
                        <SelectValue
                          placeholder={
                            !selectedPipelineId
                              ? "Selecione um pipeline primeiro"
                              : loadingColumns
                              ? "Carregando colunas..."
                              : columns.length === 0
                              ? "Nenhuma coluna disponível"
                              : "Selecione uma coluna"
                          }
                        />
                      </SelectTrigger>
                      {columns.length > 0 && (
                        <SelectContent className="dark:bg-[#2d2d2d] dark:border-gray-700">
                          {columns.map((column) => (
                            <SelectItem
                              key={column.id}
                              value={column.id}
                              className="text-xs dark:text-gray-200 dark:focus:bg-gray-700"
                            >
                              {column.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      )}
                    </Select>
                  </div>

                  {/* Queue Select */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Fila (Opcional)
                    </Label>
                    <Select
                      value={selectedQueueId}
                      onValueChange={setSelectedQueueId}
                      disabled={loadingQueues || !queues || queues.length === 0}
                    >
                      <SelectTrigger className="h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d] text-gray-900 dark:text-gray-100">
                        <SelectValue
                          placeholder={
                            loadingQueues
                              ? "Carregando filas..."
                              : !queues || queues.length === 0
                              ? "Nenhuma fila disponível"
                              : "Usar fila padrão da conexão"
                          }
                        />
                      </SelectTrigger>
                      {queues && queues.length > 0 && (
                        <SelectContent className="dark:bg-[#2d2d2d] dark:border-gray-700">
                          {queues.map((queue) => (
                            <SelectItem
                              key={queue.id}
                              value={queue.id}
                              className="text-xs dark:text-gray-200 dark:focus:bg-gray-700"
                            >
                              {queue.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      )}
                    </Select>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Se nenhuma fila for selecionada, será usada a fila padrão configurada na conexão (quando existir).
                    </p>
                  </div>

                  {/* Tags Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Tags (Opcional)
                    </Label>
                    {loadingTags ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">Carregando tags...</p>
                    ) : tags.length === 0 ? (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Nenhuma etiqueta disponível no workspace
                      </p>
                    ) : (
                      <div className="max-h-40 overflow-y-auto border border-[#d4d4d4] dark:border-gray-700 rounded p-2 bg-white dark:bg-[#2d2d2d]">
                        <div className="space-y-2">
                          {tags.map((tag) => (
                            <label
                              key={tag.id}
                              className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-1 rounded text-xs"
                            >
                              <input
                                type="checkbox"
                                checked={selectedTagIds.includes(tag.id)}
                                onChange={() => toggleTag(tag.id)}
                                className="w-4 h-4 rounded border-[#d4d4d4] dark:border-gray-700 text-primary focus:ring-primary"
                              />
                              <span
                                className="inline-block w-3 h-3 rounded-full"
                                style={{ backgroundColor: tag.color || "#6366f1" }}
                              />
                              <span className="text-gray-900 dark:text-gray-100">{tag.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    {selectedTagIds.length > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {selectedTagIds.length} etiqueta(s) selecionada(s)
                      </p>
                    )}
                  </div>

                  {/* Conversation Options */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="createConversation"
                        checked={createConversation}
                        onChange={(e) => setCreateConversation(e.target.checked)}
                        className="w-4 h-4 rounded border-[#d4d4d4] dark:border-gray-700 text-primary focus:ring-primary"
                      />
                      <Label
                        htmlFor="createConversation"
                        className="text-xs font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                      >
                        Criar conversa
                      </Label>
                    </div>
                    {createConversation && (
                      <div className="space-y-2 ml-6">
                        <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          Mensagem inicial (Opcional)
                        </Label>
                        <Input
                          value={initialMessage}
                          onChange={(e) => setInitialMessage(e.target.value)}
                          placeholder="Ex: Olá! Bem-vindo ao nosso atendimento..."
                          className="h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d] text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Esta mensagem será enviada automaticamente quando a conversa for criada
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Generated Payload */}
              {selectedPipelineId && selectedColumnId && (
                <Card className="border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1f1f1f]">
                  <CardHeader className="bg-white dark:bg-[#1f1f1f]">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm text-gray-800 dark:text-gray-200">Payload Gerado</CardTitle>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={copyPayload}
                        className="h-7 px-3 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                      >
                        {copiedPayload ? (
                          <>
                            <Check className="w-3.5 h-3.5 mr-1.5" />
                            Copiado
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 mr-1.5" />
                            Copiar
                          </>
                        )}
                      </Button>
                    </div>
                    <CardDescription className="text-xs text-gray-600 dark:text-gray-400">
                      Use este payload na sua requisição para criar contato e card simultaneamente
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="bg-white dark:bg-[#1f1f1f]">
                    <pre className="text-xs bg-[#f3f3f3] dark:bg-[#2d2d2d] p-4 rounded border border-[#d4d4d4] dark:border-gray-700 overflow-x-auto text-gray-900 dark:text-gray-100">
                      {generatePayload()}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {(!selectedPipelineId || !selectedColumnId) && (
                <Card className="border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1f1f1f]">
                  <CardContent className="pt-6 bg-white dark:bg-[#1f1f1f]">
                    <div className="text-center py-8">
                      <Code className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Selecione um pipeline e uma coluna para gerar o payload
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar a API Key "{keyToDelete?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteKey} className="bg-red-600 hover:bg-red-700">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

