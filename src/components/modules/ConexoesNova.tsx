import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { getRandomConnectionColor } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Trash2, Wifi, QrCode, Plus, MoreVertical, Edit3, RefreshCw, Webhook, Star, Bug, ArrowRight, Zap, Cloud, Settings, Search, Download, Upload, Filter, Smartphone, Power, PowerOff, History } from 'lucide-react';
import { TestWebhookReceptionModal } from "@/components/modals/TestWebhookReceptionModal";
import { ConfigureZapiWebhookModal } from "@/components/modals/ConfigureZapiWebhookModal";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { toast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { evolutionProvider } from '@/services/EvolutionProvider';
import type { Connection, HISTORY_RECOVERY_MAP } from '@/types/evolution';
import { useWorkspaceLimits } from '@/hooks/useWorkspaceLimits';
import { useWorkspaceRole } from '@/hooks/useWorkspaceRole';
import { usePipelinesContext } from '@/contexts/PipelinesContext';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQueues } from '@/hooks/useQueues';
import { useAuth } from '@/hooks/useAuth';
import { useWhatsAppProviders } from '@/hooks/useWhatsAppProviders';
import { cn } from "@/lib/utils";

// Helper functions for phone number formatting
const normalizePhoneNumber = (phone: string): string => {
  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly && !digitsOnly.startsWith('55')) {
    return `55${digitsOnly}`;
  }
  return digitsOnly;
};

const formatPhoneNumberDisplay = (phone: string): string => {
  if (!phone) return '-';
  
  const normalized = normalizePhoneNumber(phone);
  if (normalized.length >= 13) {
    const country = normalized.slice(0, 2);
    const area = normalized.slice(2, 4);
    const firstPart = normalized.slice(4, 9);
    const secondPart = normalized.slice(9, 13);
    return `${country} (${area}) ${firstPart}-${secondPart}`;
  }
  
  return phone;
};

const PHONE_LENGTH_REGEX = /^\d{12,13}$/;

const ALLOWED_CONNECTION_STATUSES: Connection['status'][] = ['creating', 'qr', 'connecting', 'connected', 'disconnected', 'error'];

const normalizeConnectionStatus = (status?: string | null): Connection['status'] => {
  if (!status) {
    return 'disconnected';
  }

  const normalized = status.toLowerCase() as Connection['status'];
  return ALLOWED_CONNECTION_STATUSES.includes(normalized) ? normalized : 'disconnected';
};

const withNormalizedStatus = (connection: Connection): Connection => ({
  ...connection,
  status: normalizeConnectionStatus(connection.status),
});

interface ConexoesNovaProps {
  workspaceId: string;
}

export function ConexoesNova({ workspaceId }: ConexoesNovaProps) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [workspacePipelines, setWorkspacePipelines] = useState<any[]>([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  
  const { usage, isLoading: isLoadingLimits, refreshLimits } = useWorkspaceLimits(workspaceId);
  const { canCreateConnections } = useWorkspaceRole();
  const navigate = useNavigate();
  const { queues } = useQueues(workspaceId);
  const { userRole } = useAuth();
  const { workspaceId: urlWorkspaceId } = useParams<{ workspaceId: string }>();
  
  // Detectar se está na master-dashboard
  const isInMasterDashboard = window.location.pathname === '/master-dashboard';

  // Helper function to build navigation paths
  const getNavigationPath = (path: string) => {
    if (userRole === 'master') {
      // Para Master, SEMPRE usar o workspaceId da URL atual
      const currentWorkspaceId = urlWorkspaceId || workspaceId;
      
      console.log('🔍 DEBUG getNavigationPath:', {
        userRole,
        urlWorkspaceId,
        propWorkspaceId: workspaceId,
        currentWorkspaceId,
        currentPath: window.location.pathname,
        targetPath: path
      });
      
      if (currentWorkspaceId) {
        const finalPath = `/workspace/${currentWorkspaceId}${path}`;
        console.log('✅ Navegando para:', finalPath);
        return finalPath;
      }
    }
    
    console.log('👤 Navegação direta para:', path);
    return path;
  };

  // Debug: Log usage changes
  useEffect(() => {
    console.log('🟢 ConexoesNova: workspaceId:', workspaceId);
    console.log('🟢 ConexoesNova: usage:', usage);
    console.log('🟢 ConexoesNova: isLoadingLimits:', isLoadingLimits);
  }, [usage, workspaceId, isLoadingLimits]);

  // Função para carregar pipelines do workspace específico
  const loadWorkspacePipelines = async () => {
    if (!workspaceId) return;
    
    try {
      setLoadingPipelines(true);
      
      const userData = localStorage.getItem('currentUser');
      if (!userData) {
        throw new Error('Usuário não encontrado');
      }
      
      const user = JSON.parse(userData);
      const headers = {
        'x-system-user-id': user.id,
        'x-system-user-email': user.email,
        'x-workspace-id': workspaceId
      };

      const { data, error } = await supabase.functions.invoke('pipeline-management/pipelines', {
        method: 'GET',
        headers
      });

      if (error) {
        console.error('❌ Pipeline fetch error:', error);
        throw error;
      }

      setWorkspacePipelines(data || []);
    } catch (error) {
      console.error('❌ Error fetching workspace pipelines:', error);
      setWorkspacePipelines([]);
    } finally {
      setLoadingPipelines(false);
    }
  };

  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingConnection, setEditingConnection] = useState<Connection | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [connectionToDelete, setConnectionToDelete] = useState<Connection | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState(false);
  const [confirmInstanceName, setConfirmInstanceName] = useState('');
  const [searchTerm, setSearchTerm] = useState("");
  const [isSyncingStatuses, setIsSyncingStatuses] = useState(false);
  const [lastStatusSyncAt, setLastStatusSyncAt] = useState<number | null>(null);
  
  // Form states
  const [instanceName, setInstanceName] = useState('');
  const [historyRecovery, setHistoryRecovery] = useState('none');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [createCrmCard, setCreateCrmCard] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<string>('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedQueueId, setSelectedQueueId] = useState<string>('');
  const [pipelineColumns, setPipelineColumns] = useState<any[]>([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'evolution' | 'zapi'>('evolution');
  const [hasActiveProvider, setHasActiveProvider] = useState(false);
  
  // Estado para modal de configuração de webhooks Z-API
  const [isConfigureWebhookModalOpen, setIsConfigureWebhookModalOpen] = useState(false);
  const [connectionToConfigureWebhook, setConnectionToConfigureWebhook] = useState<Connection | null>(null);
  
  // Estado para modal de histórico de conexões
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyConnection, setHistoryConnection] = useState<Connection | null>(null);
  const [connectionHistory, setConnectionHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Hook para gerenciar providers
  const { providers, isLoading: loadingProvider, fetchProviders } = useWhatsAppProviders(workspaceId);

  const isEditingZapi = isEditMode && editingConnection?.provider?.provider === 'zapi';

  // Load connections on component mount
  useEffect(() => {
    if (!workspaceId) {
      return;
    }

    console.log('🔄 ConexoesNova: Loading connections and sincronizando status em tempo real');

    const loadAndSync = async () => {
      const loadedConnections = await loadConnections();
      if (loadedConnections && loadedConnections.length > 0) {
        await syncConnectionStatuses({ showToast: false, targetConnections: loadedConnections });
      }
    };

    loadAndSync();
  }, [workspaceId]);

  // Monitor selected connection status and close modal when connected
  useEffect(() => {
    console.log('[ConexoesNova] useEffect status monitor - selectedConnection:', selectedConnection?.instance_name, 'status:', selectedConnection?.status, 'isQRModalOpen:', isQRModalOpen);
    
    if (!selectedConnection) {
      return;
    }

    const normalizedStatus = normalizeConnectionStatus(selectedConnection.status);
    console.log('[ConexoesNova] normalizedStatus:', normalizedStatus);

    if (normalizedStatus === 'connected' && isQRModalOpen) {
      console.log('✅ Conexão estabelecida, fechando modal automaticamente');
      
      // Close modal
      setIsQRModalOpen(false);
      setSelectedConnection(null);
      
      // Reload connections to update the UI
      loadConnections();
      
      // Show success toast
      toast({
        title: '✅ Conectado!',
        description: selectedConnection.phone_number ? 
          `WhatsApp conectado como ${selectedConnection.phone_number}!` : 
          'WhatsApp conectado com sucesso!',
      });
    }
  }, [selectedConnection, isQRModalOpen]);

  // Realtime listener para detectar mudanças no status da conexão selecionada
  useEffect(() => {
    if (!selectedConnection?.id || !isQRModalOpen) {
      return;
    }

    console.log('[ConexoesNova] Configurando realtime para conexão selecionada:', selectedConnection.id);

    const channel = supabase
      .channel(`selected-connection-${selectedConnection.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'connections',
          filter: `id=eq.${selectedConnection.id}`
        },
        (payload) => {
          console.log('[ConexoesNova] Mudança detectada na conexão selecionada:', payload);
          const newStatus = payload.new?.status;
          const newPhoneNumber = payload.new?.phone_number;
          
          console.log('[ConexoesNova] Novo status da conexão:', newStatus);
          
          if (newStatus) {
            const normalizedStatus = normalizeConnectionStatus(newStatus);
            
            // Atualizar o selectedConnection com o novo status
            setSelectedConnection(prev => prev ? {
              ...prev,
              status: normalizedStatus,
              phone_number: newPhoneNumber || prev.phone_number
            } : null);
            
            // Se conectou, fechar modal
            if (normalizedStatus === 'connected') {
              console.log('✅ [Realtime] Conexão estabelecida! Fechando modal...');
              setIsQRModalOpen(false);
              setSelectedConnection(null);
              loadConnections();
              
              toast({
                title: '✅ Conectado!',
                description: newPhoneNumber ? 
                  `WhatsApp conectado como ${newPhoneNumber}!` : 
                  'WhatsApp conectado com sucesso!',
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[ConexoesNova] Removendo channel da conexão selecionada');
      supabase.removeChannel(channel);
    };
  }, [selectedConnection?.id, isQRModalOpen]);

  // Carregar pipelines e providers quando o modal for aberto
  useEffect(() => {
    const loadModalData = async () => {
      if (isCreateModalOpen && workspaceId) {
        // Sempre carregar pipelines, tanto na criação quanto na edição
        loadWorkspacePipelines();
        
        // Buscar providers através do hook (apenas na criação)
        if (!isEditMode) {
          console.log('🔍 Carregando providers para workspace:', workspaceId);
          await fetchProviders();
        }
      }
    };
    
    loadModalData();
  }, [isCreateModalOpen, workspaceId, isEditMode]);
  
  // Atualizar provider selecionado quando os providers forem carregados
  useEffect(() => {
    if (providers && providers.length > 0) {
      console.log('📋 Providers carregados:', providers);
      
      // Buscar provider ativo
      const activeProvider = providers.find(p => p.is_active);
      
      if (activeProvider) {
        console.log('✅ Provider ativo encontrado:', activeProvider.provider);
        setSelectedProvider(activeProvider.provider as 'evolution' | 'zapi');
        setHasActiveProvider(true);
      } else {
        console.log('⚠️ Nenhum provider ativo, usando primeiro disponível ou Evolution');
        const firstProvider = providers[0];
        setSelectedProvider((firstProvider?.provider as 'evolution' | 'zapi') || 'evolution');
        setHasActiveProvider(false);
      }
    } else if (providers && providers.length === 0) {
      console.log('⚠️ Nenhum provider configurado');
      setSelectedProvider('evolution');
      setHasActiveProvider(false);
    }
  }, [providers]);

  // Carregar colunas quando pipeline for selecionado
  useEffect(() => {
    const loadPipelineColumns = async () => {
      if (!selectedPipeline || !workspaceId) {
        setPipelineColumns([]);
        setSelectedColumn('');
        setLoadingColumns(false);
        return;
      }

      try {
        setLoadingColumns(true);
        
        const { data, error } = await supabase
          .from('pipeline_columns')
          .select('*')
          .eq('pipeline_id', selectedPipeline)
          .order('order_position', { ascending: true });

        if (error) throw error;
        
        console.log('✅ Colunas carregadas:', data);
        setPipelineColumns(data || []);
        
        // Se não estiver editando, selecionar a primeira coluna automaticamente
        if (!selectedColumn && data && data.length > 0) {
          setSelectedColumn(data[0].id);
        }
      } catch (error) {
        console.error('❌ Erro ao carregar colunas:', error);
        setPipelineColumns([]);
      } finally {
        setLoadingColumns(false);
      }
    };

    loadPipelineColumns();
  }, [selectedPipeline, workspaceId]);

  const loadConnections = async () => {
    try {
      setIsLoading(true);
      
      const response = await evolutionProvider.listConnections(workspaceId);
      console.log('📋 ConexoesNova received response:', response);
      
      const normalizedConnections = response.connections.map(withNormalizedStatus);
      setConnections(normalizedConnections);
      refreshLimits();
      return normalizedConnections;
    } catch (error) {
      console.warn('Error loading connections:', error);
      setConnections([]);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLiveConnectionStatus = async (connection: Connection) => {
    if (connection.provider?.provider === 'zapi') {
      const { data, error } = await supabase.functions.invoke('force-zapi-status-refresh', {
        body: { connectionId: connection.id }
      });

      if (error) {
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao consultar status Z-API');
      }

      return {
        id: connection.id,
        status: normalizeConnectionStatus(data.newStatus || 'disconnected'),
        phone_number: data.status?.phone as string | undefined,
      };
    }

    const statusResponse = await evolutionProvider.getConnectionStatus(connection.id);
    return {
      id: connection.id,
      status: normalizeConnectionStatus(statusResponse.status),
      phone_number: statusResponse.phone_number,
    };
  };

  const syncConnectionStatuses = async ({
    targetConnections,
    showToast = true,
  }: {
    targetConnections?: Connection[];
    showToast?: boolean;
  } = {}) => {
    const connectionsToSync = targetConnections ?? connections;
    
    if (!connectionsToSync.length) {
      return;
    }

    setIsSyncingStatuses(true);
    try {
      const results = await Promise.allSettled(
        connectionsToSync.map((connection) => fetchLiveConnectionStatus(connection))
      );

      const updatesMap = new Map<string, { status: Connection['status']; phone_number?: string }>();
      let successCount = 0;

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          updatesMap.set(result.value.id, {
            status: result.value.status,
            phone_number: result.value.phone_number,
          });
          successCount += 1;
        } else {
          console.error('Erro ao sincronizar status da conexão:', result.reason);
        }
      });

      if (updatesMap.size > 0) {
        setConnections((prev) =>
          prev.map((connection) => {
            const update = updatesMap.get(connection.id);
            if (!update) {
              return connection;
            }
            return {
              ...connection,
              status: update.status,
              phone_number: update.phone_number || connection.phone_number,
            };
          })
        );
        setLastStatusSyncAt(Date.now());
      }

      if (showToast) {
        if (successCount === 0) {
          toast({
            title: 'Não foi possível atualizar os status',
            description: 'Nenhuma conexão respondeu ao provider.',
            variant: 'destructive',
          });
        } else if (successCount < connectionsToSync.length) {
          toast({
            title: 'Status parcialmente atualizados',
            description: 'Algumas conexões não responderam. Verifique os logs.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Status atualizados',
            description: 'Consultamos todas as conexões em tempo real.',
          });
        }
      }
    } catch (error) {
      console.error('Erro ao sincronizar status das conexões:', error);
      if (showToast) {
        toast({
          title: 'Erro',
          description: error instanceof Error ? error.message : 'Não foi possível atualizar os status agora.',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSyncingStatuses(false);
    }
  };

  const refreshQRCode = async (connectionId: string) => {
    try {
      setIsRefreshing(true);
      console.log(`🔄 Refreshing QR code for connection ${connectionId}`);
      
      // Buscar conexão para verificar provider
      const connection = connections.find(c => c.id === connectionId);
      
      if (!connection) {
        throw new Error('Conexão não encontrada');
      }

      // Se for Z-API, usar endpoint específico
      if (connection.provider?.provider === 'zapi') {
        console.log('📱 Refreshing Z-API QR code');
        
        const { data, error } = await supabase.functions.invoke('refresh-zapi-qr', {
          body: { connectionId }
        });

        if (error) throw error;

        if (!data.success) {
          throw new Error(data.error || 'Erro ao atualizar QR code');
        }

        // Atualizar conexão local com novo QR
        if (selectedConnection) {
          setSelectedConnection(prev => prev ? { 
            ...prev, 
            qr_code: data.qrCode, 
            status: 'qr' 
          } : null);
        }

        // Recarregar conexões
        await loadConnections();

        toast({
          title: 'QR Code Atualizado',
          description: 'Escaneie o novo QR code Z-API com seu WhatsApp',
        });

        return;
      }

      // Evolution API (comportamento original)
      const response = await evolutionProvider.getQRCode(connectionId);
      
      if (response.qr_code && selectedConnection) {
        // Update the connection with new QR code
        setSelectedConnection(prev => prev ? { ...prev, qr_code: response.qr_code, status: 'qr' } : null);

        toast({
          title: 'QR Code Atualizado',
          description: 'Escaneie o novo QR code com seu WhatsApp',
        });
      }
    } catch (error) {
      console.error('Error refreshing QR code:', error);
      toast({
        title: 'Erro',
        description: `Erro ao atualizar QR Code: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const createInstance = async (retryCount = 0) => {
    if (!instanceName.trim()) {
      toast({
        title: 'Erro',
        description: 'Nome da instância é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    // Check frontend limit before making the request
    if (usage && !usage.canCreateMore) {
      toast({
        title: 'Limite atingido',
        description: `Não é possível criar mais conexões. Limite: ${usage.current}/${usage.limit}`,
        variant: 'destructive',
      });
      return;
    }

    // Check for duplicate instance names
    const existingConnection = connections.find(conn => 
      conn.instance_name.toLowerCase() === instanceName.trim().toLowerCase()
    );
    
    if (existingConnection) {
      toast({
        title: 'Erro',
        description: 'Já existe uma conexão com este nome',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsCreating(true);

      // Gera cor aleatória para a nova conexão
      const connectionColor = getRandomConnectionColor();

      // Buscar nome da coluna selecionada
      const selectedColumnData = pipelineColumns.find(col => col.id === selectedColumn);
      
      const normalizedPhone = (phoneNumber || "").replace(/\D/g, "");

      if (!PHONE_LENGTH_REGEX.test(normalizedPhone)) {
        toast({
          title: 'Número inválido',
          description: 'Informe um número com 12 ou 13 dígitos (somente números).',
          variant: 'destructive',
        });
        return;
      }

      const connectionData = {
        instanceName: instanceName.trim(),
        historyRecovery: historyRecovery as 'none' | 'week' | 'month' | 'quarter',
        workspaceId,
        autoCreateCrmCard: createCrmCard,
        defaultPipelineId: selectedPipeline || null,
        defaultColumnId: selectedColumn || null,
        defaultColumnName: selectedColumnData?.name || null,
        queueId: (selectedQueueId && selectedQueueId !== 'no_queue') ? selectedQueueId : null,
        phoneNumber: normalizedPhone,
        provider: selectedProvider,
        metadata: {
          border_color: connectionColor
        }
      };

      console.log('📤 Creating connection with data:', {
        ...connectionData,
        selectedColumn,
        selectedPipeline,
        selectedColumnData,
        pipelineColumnsCount: pipelineColumns.length
      });
      
      const connection = await evolutionProvider.createConnection(connectionData);

      // Connection created

      toast({
        title: 'Sucesso',
        description: 'Conexão criada com sucesso!',
      });
      
      // Reset form and close modal
      resetModal();
      
      // Reload connections (silently)
      loadConnections();
      refreshLimits(); // Refresh limits after creating connection

      // If connection has QR code, automatically open QR modal
      if (connection.qr_code) {
        console.log('QR Code already available, opening modal');
        setSelectedConnection(withNormalizedStatus(connection));
        setIsQRModalOpen(true);
        startPolling(connection.id);
        
        // Show sync notification if history recovery is enabled
        if (historyRecovery !== 'none') {
          const historyLabels = {
            'week': '1 semana',
            'month': '1 mês',
            'quarter': '3 meses'
          };
          
          toast({
            title: 'Sincronização Habilitada',
            description: `Após conectar, o histórico de ${historyLabels[historyRecovery as keyof typeof historyLabels]} será sincronizado automaticamente.`,
            duration: 5000,
          });
        }
      } else {
        // Para Z-API, configurar webhooks automaticamente e não buscar QR
        const isZAPI = selectedProvider === 'zapi';
        if (!isZAPI) {
          // Apenas para Evolution, buscar QR automaticamente
          console.log('No QR code in response, trying to get one...');
          connectInstance(connection);
        } else {
          console.log('Z-API instance created, configuring webhooks automatically...');
          // Auto-configurar webhooks para Z-API (silenciosamente)
          try {
            await supabase.functions.invoke('configure-zapi-webhook', {
              body: {
                connectionId: connection.id,
                instanceName: connection.instance_name,
                webhookType: 'all'
              }
            });
            console.log('✅ Webhooks Z-API configurados automaticamente');
          } catch (error) {
            console.error('❌ Erro ao configurar webhooks:', error);
          }
        }
      }

    } catch (error) {
      console.error('❌ Error creating instance:', error);
      
      // Check if it's a CORS or network error and retry up to 3 times
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      // Verificar se é erro de provider não configurado
      if (errorMessage.includes('não está configurado') || errorMessage.includes('Provider') && errorMessage.includes('não está configurado')) {
        toast({
          title: 'Provider não configurado',
          description: errorMessage + ' Acesse Configurações > Providers WhatsApp para configurar.',
          variant: 'destructive',
          duration: 8000,
        });
        setIsCreating(false);
        return;
      }
      
      const isCorsError = errorMessage.toLowerCase().includes('cors') || 
                         errorMessage.toLowerCase().includes('network') ||
                         errorMessage.toLowerCase().includes('fetch');
      
      if (isCorsError && retryCount < 3) {
        console.log(`🔄 Retrying connection creation (attempt ${retryCount + 1}/3)...`);
        
        // Show retry toast
        toast({
          title: 'Reconectando...',
          description: `Tentativa ${retryCount + 1} de 3. Aguarde...`,
        });
        
        // Wait 2 seconds before retry
        setTimeout(() => {
          createInstance(retryCount + 1);
        }, 2000);
        
        return;
      }
      
      // Show final error message
      toast({
        title: 'Erro',
        description: retryCount > 0 
          ? `Erro após ${retryCount + 1} tentativas: ${errorMessage}`
          : `Erro ao criar conexão: ${errorMessage}`,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const editConnection = async () => {
    if (!editingConnection) return;

    const trimmedInstanceName = instanceName.trim();
    const isZapiConnection = editingConnection.provider?.provider === 'zapi';

    if (isZapiConnection) {
      if (!trimmedInstanceName) {
        toast({
          title: 'Erro',
          description: 'Nome da instância é obrigatório para renomear.',
          variant: 'destructive',
        });
        return;
      }

      const duplicateName = connections.some(conn =>
        conn.id !== editingConnection.id &&
        conn.instance_name.toLowerCase() === trimmedInstanceName.toLowerCase()
      );

      if (duplicateName) {
        toast({
          title: 'Nome duplicado',
          description: 'Já existe outra conexão com este nome. Escolha um nome diferente.',
          variant: 'destructive',
        });
        return;
      }
    }

    const normalizedPhone = phoneNumber ? normalizePhoneNumber(phoneNumber) : null;

    if (normalizedPhone && !PHONE_LENGTH_REGEX.test(normalizedPhone)) {
      toast({
        title: 'Número inválido',
        description: 'Informe um número com 12 ou 13 dígitos (somente números).',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      // Buscar nome da coluna selecionada
      const selectedColumnData = pipelineColumns.find(col => col.id === selectedColumn);
      
      const updateData = {
        connectionId: editingConnection.id,
        phone_number: normalizedPhone,
        auto_create_crm_card: createCrmCard,
        default_pipeline_id: selectedPipeline || null,
        default_column_id: selectedColumn || null,
        default_column_name: selectedColumnData?.name || null,
        queue_id: (selectedQueueId && selectedQueueId !== 'no_queue') ? selectedQueueId : null,
      };

      if (isZapiConnection && trimmedInstanceName) {
        (updateData as any).instance_name = trimmedInstanceName;
      }

      console.log('Updating connection with data:', updateData);

      await evolutionProvider.updateConnection(updateData);
      
      toast({
        title: "Sucesso",
        description: "Conexão atualizada com sucesso!",
      });

      // Refresh connections list
      await loadConnections();
      
      // Reset form and close modal
      resetModal();
      
    } catch (error) {
      console.error('Error updating connection:', error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao atualizar conexão",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resetModal = () => {
    setInstanceName('');
    setPhoneNumber('');
    setHistoryRecovery('none');
    setCreateCrmCard(false);
    setSelectedPipeline('');
    setSelectedColumn('');
    setSelectedQueueId('');
    setPipelineColumns([]);
    setLoadingColumns(false);
    setIsEditMode(false);
    setEditingConnection(null);
    setIsCreateModalOpen(false);
    setSelectedProvider('evolution');
  };

  const openEditModal = (connection: Connection) => {
    setEditingConnection(connection);
    setInstanceName(connection.instance_name);
    setPhoneNumber(connection.phone_number || '');
    setHistoryRecovery(connection.history_recovery);
    setCreateCrmCard(connection.auto_create_crm_card || false);
    setSelectedPipeline(connection.default_pipeline_id || '');
    setSelectedColumn(connection.default_column_id || '');
    setSelectedQueueId(connection.queue_id || '');
    setSelectedProvider(connection.provider?.provider || 'evolution');
    setIsEditMode(true);
    setIsCreateModalOpen(true);
  };

  const openDeleteModal = (connection: Connection) => {
    if (userRole !== 'master') {
      toast({
        title: "Permissão negada",
        description: "Apenas usuários master podem excluir conexões.",
        variant: "destructive",
      });
      return;
    }

    setConnectionToDelete(connection);
    setConfirmInstanceName('');
    setIsDeleteModalOpen(true);
  };

  const removeConnection = async () => {
    if (userRole !== 'master') {
      toast({
        title: "Permissão negada",
        description: "Apenas usuários master podem excluir conexões.",
        variant: "destructive",
      });
      setIsDeleteModalOpen(false);
      setConnectionToDelete(null);
      return;
    }

    if (!connectionToDelete) return;

    try {
      setIsDisconnecting(true);

      const result = await evolutionProvider.deleteConnection(connectionToDelete.id);

      if (result.success) {
        toast({
          title: "Sucesso",
          description: "Instância excluída com sucesso",
          variant: "default",
        });
      } else {
        toast({
          title: "Erro",
          description: "Erro ao excluir conexão",
          variant: "destructive",
        });
      }

      loadConnections(); // Silent reload
      refreshLimits(); // Refresh limits after deleting connection
      setIsDeleteModalOpen(false);
      setConnectionToDelete(null);

    } catch (error: any) {
      console.error('Error deleting connection:', error);
      
      // Verificar se é erro de cancelamento de assinatura
      const errorMessage = error?.message || String(error);
      if (errorMessage.includes('cancelar a assinatura')) {
        toast({
          title: "Erro ao Cancelar Assinatura",
          description: "Não conseguimos cancelar a assinatura. Verifique com o suporte.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: "Erro ao excluir conexão",
          variant: "destructive",
        });
      }
    } finally {
      setIsDisconnecting(false);
    }
  };

  const connectInstance = async (connection: Connection) => {
    try {
      setIsConnecting(true);
      setSelectedConnection(withNormalizedStatus(connection));
      
      // Verificar qual provider está sendo usado
      const isZAPI = connection.provider?.provider === 'zapi';
      console.log('🔌 Conectando instância:', { 
        instanceName: connection.instance_name, 
        provider: connection.provider?.provider || 'evolution',
        isZAPI 
      });
      
      // Check if connection already has QR code
      if (connection.qr_code) {
        console.log('Using existing QR code:', connection.qr_code);
        
        // If qr_code is a JSON string, parse it and extract base64
        let qrCodeData = connection.qr_code;
        try {
          const parsed = JSON.parse(connection.qr_code);
          if (parsed.base64) {
            qrCodeData = parsed.base64;
          }
        } catch (e) {
          // If it's not JSON, use as is
          console.log('QR code is not JSON, using as is');
        }
        
        setSelectedConnection(prev => prev ? { ...prev, qr_code: qrCodeData, status: 'qr' } : null);
        setIsQRModalOpen(true);
        
        // Start polling for connection status
        startPolling(connection.id);
        return;
      }
      
      // Se for Z-API, buscar QR code do Z-API
      if (isZAPI) {
        console.log('📱 Buscando QR Code do Z-API');
        
        const { data, error } = await supabase.functions.invoke('refresh-zapi-qr', {
          body: { connectionId: connection.id }
        });

        if (error) throw error;
        if (!data?.success) {
          throw new Error(data?.error || 'Erro ao obter QR Code do Z-API');
        }

        if (data.qrCode) {
          setSelectedConnection(prev => prev ? { ...prev, qr_code: data.qrCode, status: 'qr' } : null);
          setIsQRModalOpen(true);
          startPolling(connection.id);
          loadConnections();
        } else {
          throw new Error('QR Code não encontrado na resposta do Z-API');
        }
        
        return;
      }
      
      // Evolution API (comportamento original)
      const response = await evolutionProvider.getQRCode(connection.id);
      
      if (response.qr_code) {
        // Update the connection with QR code
        setSelectedConnection(prev => prev ? { ...prev, qr_code: response.qr_code, status: 'qr' } : null);
        setIsQRModalOpen(true);
        
        // Start polling for connection status
        startPolling(connection.id);
        
        // Reload connections to get updated status (silently)
        loadConnections();
      } else {
        throw new Error('QR Code não encontrado na resposta');
      }

    } catch (error) {
      console.error('Error connecting instance:', error);
      toast({
        title: 'Erro',
        description: `Erro ao conectar conexão: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const startPolling = (connectionId: string) => {
    // Polling logic remains the same as before
    console.log(`🔄 Starting status check for connection ${connectionId}`);
    
    const connection = connections.find(c => c.id === connectionId);
    const isZAPI = connection?.provider?.provider === 'zapi';
    
    console.log(`🔌 Polling para provider: ${isZAPI ? 'Z-API' : 'Evolution'}`);
    
    let lastNotifiedStatus: string | null = null;
    let isInitialCheck = true; 
    
    const checkStatus = async () => {
      try {
        if (!connection) {
          return false;
        }
        
        let connectionStatus;
        
        if (isZAPI) {
          const { data, error } = await supabase.functions.invoke('force-zapi-status-refresh', {
            body: { connectionId }
          });
          
          if (error) throw error;
          if (!data?.success) {
            throw new Error(data?.error || 'Erro ao verificar status Z-API');
          }
          
          connectionStatus = {
            id: connectionId,
            instance_name: connection?.instance_name || '',
            status: data.newStatus || 'disconnected',
            phone_number: data.status?.phone || undefined,
          };
        } else {
          connectionStatus = await evolutionProvider.getConnectionStatus(connectionId);
        }
        
        const normalizedStatus = normalizeConnectionStatus(connectionStatus.status);

        if (selectedConnection) {
          const isSelectedQR = normalizeConnectionStatus(selectedConnection.status) === 'qr';
          const shouldUpdate = !(isSelectedQR && normalizedStatus === 'disconnected');
          
          if (shouldUpdate) {
            setSelectedConnection(prev => prev ? { 
              ...prev, 
              status: normalizedStatus,
              phone_number: connectionStatus.phone_number || prev.phone_number
            } : null);
          }
        }
        
        if (normalizedStatus === 'connected' && lastNotifiedStatus !== 'connected') {
          lastNotifiedStatus = 'connected';
          
          setConnections(prev => prev.map(conn => 
            conn.id === connectionId 
              ? { 
                  ...conn, 
                  status: 'connected', 
                  phone_number: connectionStatus.phone_number || conn.phone_number 
                } 
              : conn
          ));
          
          setIsQRModalOpen(false);
          setSelectedConnection(null);
          
          await loadConnections();
          
          toast({
            title: '✅ Conectado!',
            description: connectionStatus.phone_number ? 
              `WhatsApp conectado como ${connectionStatus.phone_number}!` : 
              'WhatsApp conectado com sucesso!',
          });
          
          return true; 
        } 
        
        if (normalizedStatus === 'disconnected' && 
            !isInitialCheck && 
            normalizeConnectionStatus(selectedConnection?.status) !== 'qr' && 
            lastNotifiedStatus !== 'disconnected') {
          lastNotifiedStatus = 'disconnected';
          
          setConnections(prev => prev.map(conn => 
            conn.id === connectionId 
              ? { 
                  ...conn, 
                  status: 'disconnected', 
                  phone_number: connectionStatus.phone_number || conn.phone_number 
                } 
              : conn
          ));
          
          setIsQRModalOpen(false);
          setSelectedConnection(null);
          
          await loadConnections();
          
          toast({
            title: 'Desconectado',
            description: `Conexão foi desconectada.`,
            variant: "destructive",
          });
          
          return true; 
        }
        
        if (isInitialCheck) {
          isInitialCheck = false;
        }
        
        return false; 
      } catch (error) {
        console.error('Error polling connection status:', error);
        
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('404') || errorMessage.includes('not found') || errorMessage.includes('Connection not found')) {
          
          setIsQRModalOpen(false);
          setSelectedConnection(null);
          
          await loadConnections();
          
          toast({
            title: "Erro",
            description: "Conexão não encontrada. A conexão pode ter sido deletada.",
            variant: "destructive"
          });
          
          return true; 
        }
        
        return false; 
      }
    };
    
    checkStatus();
  };

  const disconnectInstance = async (connection: Connection) => {
    try {
      setIsDisconnecting(true);
      
      const isZapi = connection.provider?.provider === 'zapi';
      
      if (isZapi) {
        const { data, error } = await supabase.functions.invoke('disconnect-zapi', {
          body: { connectionId: connection.id }
        });

        if (error) throw error;

        if (!data.success) {
          throw new Error(data.error || 'Erro ao desconectar Z-API');
        }

        toast({
          title: 'Sucesso',
          description: data.message || 'Conexão Z-API desconectada com sucesso!',
        });
      } else {
        await evolutionProvider.pauseInstance(connection.id);

        toast({
          title: 'Sucesso',
          description: 'Instância Evolution desconectada com sucesso!',
        });
      }
      
      loadConnections();

    } catch (error) {
      console.error('Error disconnecting instance:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao desconectar conexão',
        variant: 'destructive',
      });
      loadConnections();
    } finally {
      setIsDisconnecting(false);
    }
  };

  const setDefaultConnection = async (connection: Connection) => {
    try {
      setIsSettingDefault(true);
      
      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;
      
      if (!currentUserData?.id) {
        throw new Error('Usuário não autenticado');
      }

      const headers = {
        'x-system-user-id': currentUserData.id,
        'x-system-user-email': currentUserData.email || '',
        'x-workspace-id': workspaceId
      };
      
      const { data, error } = await supabase.functions.invoke('set-default-instance', {
        body: { connectionId: connection.id },
        headers
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to set default connection');
      }

      toast({
        title: 'Sucesso',
        description: data.message || `${connection.instance_name} definida como conexão padrão`,
      });
      
      loadConnections();
      
    } catch (error) {
      console.error('Error setting default connection:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao definir conexão padrão',
        variant: 'destructive',
      });
    } finally {
      setIsSettingDefault(false);
    }
  };

  const openHistoryModal = async (connection: Connection) => {
    setHistoryConnection(connection);
    setIsHistoryModalOpen(true);
    setIsLoadingHistory(true);
    
    console.log('🔍 Buscando histórico para conexão:', {
      id: connection.id,
      instance_name: connection.instance_name,
      workspace_id: workspaceId
    });
    
    try {
      // Usar Edge Function para bypassar RLS
      const { data, error } = await supabase.functions.invoke('get-connection-history', {
        body: {
          connectionId: connection.id,
          workspaceId: workspaceId
        }
      });

      console.log('📋 Resultado da Edge Function:', { data, error });

      if (error) throw error;
      
      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao buscar histórico');
      }

      console.log('✅ Encontrados', data.history?.length || 0, 'registros');
      setConnectionHistory(data.history || []);
      
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o histórico de conexões',
        variant: 'destructive',
      });
      setConnectionHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <div className="flex items-center justify-center">
            <Wifi className="h-5 w-5 text-green-500" />
          </div>
        );
      case 'qr':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-700 hover:bg-orange-200">QR Code</Badge>;
      case 'connecting':
        return <Badge variant="outline" className="animate-pulse">Conectando</Badge>;
      case 'disconnected':
        return <Badge variant="destructive">Desconectado</Badge>;
      case 'creating':
        return <Badge variant="secondary">Criando</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredConnections = connections.filter(conn => 
    conn.instance_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (conn.phone_number && conn.phone_number.includes(searchTerm))
  );

  return (
    <div className="flex flex-col h-full bg-white border border-gray-300 m-2 shadow-sm font-sans text-xs dark:bg-[#0f0f0f] dark:border-gray-700 dark:text-gray-100">
      {/* Excel-like Toolbar (Ribbon) */}
      <div className="flex flex-col border-b border-gray-300 bg-[#f8f9fa] dark:border-gray-700 dark:bg-[#141414]">
        {/* Title Bar */}
        <div className="flex items-center justify-between px-4 py-1 bg-primary text-primary-foreground h-8">
          <div className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            <span className="font-semibold text-sm">Conexões WhatsApp</span>
          </div>
          <div className="text-[10px] opacity-80 dark:text-gray-200">
            {isLoading ? "Carregando..." : `Conexões criadas: ${connections.length}`}
          </div>
        </div>

        {/* Tools Bar */}
        <div className="flex items-center gap-2 p-2 overflow-x-auto">
          {/* Search Group */}
          <div className="flex items-center gap-2 border-r border-gray-300 pr-3 mr-1 dark:border-gray-700">
            <div className="relative w-48">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 h-3 w-3 dark:text-gray-400" />
              <Input
                placeholder="Pesquisar conexão..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-7 text-xs border-gray-300 rounded-none focus-visible:ring-1 focus-visible:ring-primary dark:bg-[#1b1b1b] dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </div>
          </div>

          {/* Actions Group */}
          <div className="flex items-center gap-2">
            <Dialog open={isCreateModalOpen} onOpenChange={(open) => {
              if (!open) resetModal();
              setIsCreateModalOpen(open);
            }}>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-block">
                      <DialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2 hover:bg-gray-200 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]"
                          disabled={!canCreateConnections(workspaceId) || !usage?.canCreateMore}
                        >
                          <Plus className="h-4 w-4 text-primary" />
                          <span className="text-[9px]">Adicionar Conexão</span>
                        </Button>
                      </DialogTrigger>
                    </div>
                  </TooltipTrigger>
                  {(!canCreateConnections(workspaceId) || !usage?.canCreateMore) && (
                    <TooltipContent className="rounded-none bg-white text-gray-900 border border-gray-200 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
                      <p className="text-xs">
                        {!canCreateConnections(workspaceId) 
                          ? 'Você não tem permissão para criar conexões' 
                          : `Seu Limite de Conexões é ${usage?.limit || 1}`
                        }
                      </p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              
              {/* Modal Content Wrapper */}
              {isCreateModalOpen && (
                <DialogContent className="max-w-2xl bg-white text-gray-900 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700 sm:rounded-none">
                  <DialogHeader className="px-4 py-2 bg-primary text-primary-foreground dark:text-white border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700">
                    <DialogTitle className="text-primary-foreground dark:text-white">{isEditMode ? 'Editar Conexão' : 'Nova Conexão'}</DialogTitle>
                    <div className="text-sm text-primary-foreground/90 dark:text-white/90">
                      {isEditMode ? 'Edite os detalhes da sua conexão.' : 'Adicione uma nova conexão WhatsApp ao seu workspace.'}
                    </div>
                  </DialogHeader>

                  <div className="space-y-4 py-4">
                    {!isEditMode && (
                      <div className="p-3 bg-muted/50 border rounded-none dark:bg-[#1f1f1f] dark:border-gray-700">
                        <div className="text-sm text-muted-foreground dark:text-gray-300">
                          {usage === null ? 'Carregando limites...' : `Conexões: ${usage.current}/${usage.limit}`}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="instanceName" className="text-gray-700 dark:text-gray-200">Nome da Conexão *</Label>
                      <Input
                        id="instanceName"
                        value={instanceName}
                        onChange={(e) => setInstanceName(e.target.value)}
                        placeholder="Ex: Atendimento Principal"
                        disabled={isEditMode && !isEditingZapi}
                        className="rounded-none dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phoneNumber" className="text-gray-700 dark:text-gray-200">
                        Número do WhatsApp
                      </Label>
                      <Input
                        id="phoneNumber"
                        value={phoneNumber}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, "");
                          setPhoneNumber(digitsOnly.slice(0, 13));
                        }}
                        placeholder="Ex: 5511999999999"
                        type="tel"
                        className="rounded-none dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100"
                      />
                    </div>

                    <div className="space-y-2">
                       <Label className="text-gray-700 dark:text-gray-200">Fila de Atendimento</Label>
                       <Select value={selectedQueueId} onValueChange={setSelectedQueueId}>
                          <SelectTrigger className="rounded-none dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100">
                             <SelectValue placeholder="Selecione uma fila (opcional)" />
                          </SelectTrigger>
                          <SelectContent className="rounded-none dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100">
                            <SelectItem value="no_queue">Sem fila</SelectItem>
                             {queues?.map((queue) => (
                                <SelectItem key={queue.id} value={queue.id}>
                                   {queue.name}
                                </SelectItem>
                             ))}
                          </SelectContent>
                       </Select>
                    </div>

                    <div className="flex items-center justify-between p-3 border bg-muted/20 rounded-none dark:bg-[#1a1a1a] dark:border-gray-700">
                      <div className="space-y-0.5">
                        <Label className="text-base text-gray-800 dark:text-gray-100">Criar Negócio Automaticamente</Label>
                        <p className="text-xs text-muted-foreground dark:text-gray-400">
                          Criar um card no CRM para novos contatos
                        </p>
                      </div>
                      <Switch checked={createCrmCard} onCheckedChange={setCreateCrmCard} />
                    </div>

                    {createCrmCard && (
                      <div className="space-y-4 pl-2 border-l-2 border-primary/20">
                        <div className="space-y-2">
                          <Label className="text-gray-700 dark:text-gray-200">Pipeline</Label>
                          <Select value={selectedPipeline} onValueChange={setSelectedPipeline}>
                            <SelectTrigger className="rounded-none dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100">
                              <SelectValue placeholder="Selecione um pipeline" />
                            </SelectTrigger>
                            <SelectContent className="rounded-none dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100">
                              {workspacePipelines.map((pipeline) => (
                                <SelectItem key={pipeline.id} value={pipeline.id}>
                                  {pipeline.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {selectedPipeline && (
                          <div className="space-y-2">
                            <Label className="text-gray-700 dark:text-gray-200">Etapa (Coluna)</Label>
                            <Select value={selectedColumn} onValueChange={setSelectedColumn} disabled={loadingColumns}>
                              <SelectTrigger className="rounded-none dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100">
                                <SelectValue placeholder={loadingColumns ? "Carregando..." : "Selecione uma etapa"} />
                              </SelectTrigger>
                              <SelectContent className="rounded-none dark:bg-[#161616] dark:border-gray-700 dark:text-gray-100">
                                {pipelineColumns.map((column) => (
                                  <SelectItem key={column.id} value={column.id}>
                                    {column.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <DialogFooter className="pt-2 border-t border-[#d4d4d4] dark:border-gray-700 bg-[#f7f7f7] dark:bg-[#111111]">
                    <Button variant="outline" disabled={isCreating} onClick={() => setIsCreateModalOpen(false)} className="rounded-none border border-[#d4d4d4] text-gray-800 bg-white hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:bg-transparent dark:hover:bg-[#1f1f1f] disabled:opacity-50">
                      Cancelar
                    </Button>
                    <Button 
                      onClick={isEditMode ? editConnection : () => createInstance()} 
                      disabled={isCreating || loadingProvider}
                      className="rounded-none bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-70"
                    >
                      {isCreating ? (isEditMode ? 'Salvando...' : 'Criando...') : (isEditMode ? 'Salvar Alterações' : 'Criar Conexão')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              )}
            </Dialog>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => syncConnectionStatuses()}
                    disabled={isSyncingStatuses || connections.length === 0}
                    className="h-8 px-2 hover:bg-gray-200 rounded-sm flex flex-col items-center justify-center gap-0.5 text-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]"
                  >
                    {isSyncingStatuses ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    )}
                    <span className="text-[9px]">
                      {isSyncingStatuses ? 'Verificando...' : 'Atualizar Status'}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="rounded-none bg-white text-gray-900 border border-gray-200 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
                  <p className="text-xs">Consulta o status diretamente nas conexões</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {lastStatusSyncAt && (
              <span className="text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                Última checagem {new Date(lastStatusSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}

            <div className="flex gap-2">
               <TestWebhookReceptionModal />
            </div>
          </div>
        </div>
      </div>

      {/* Table Area */}
      <div className="flex-1 overflow-auto bg-[#e6e6e6] dark:bg-[#050505]">
        <div className="inline-block min-w-full align-middle bg-white dark:bg-[#111111]">
          <table className="min-w-full border-collapse bg-white text-xs font-sans dark:bg-[#111111] dark:text-gray-100">
            <thead className="bg-[#f3f3f3] sticky top-0 z-10 dark:bg-[#1f1f1f]">
              <tr>
                <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[200px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                  <div className="flex items-center justify-between">
                    <span>Nome da Conexão</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[150px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                   <div className="flex items-center justify-between">
                    <span>Número</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 w-[80px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                   <div className="flex items-center justify-between">
                    <span>Status</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                {userRole === 'master' && (
                  <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 min-w-[120px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                     <div className="flex items-center justify-between">
                      <span>Provider</span>
                      <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                    </div>
                  </th>
                )}
                 <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 w-[50px] dark:border-gray-700 dark:text-gray-200">
                   <div className="flex items-center justify-between">
                    <span>Padrão</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
                <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 w-[140px] dark:border-gray-700 dark:text-gray-200">
                   <div className="flex items-center justify-between">
                    <span>Ações</span>
                    <div className="w-[1px] h-3 bg-gray-400 mx-1" />
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredConnections.length === 0 ? (
                 <tr>
                  <td colSpan={6} className="border border-[#e0e0e0] text-center py-12 bg-gray-50 text-muted-foreground dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-gray-400">
                    {isLoading ? "Carregando conexões..." : "Nenhuma conexão encontrada."}
                  </td>
                </tr>
              ) : (
                filteredConnections.map((connection) => (
                  <tr key={connection.id} className="hover:bg-blue-50 group h-[40px] dark:hover:bg-[#1f2937]">
                    <td className="border border-[#e0e0e0] px-2 py-0 font-medium align-middle dark:border-gray-700">
                      {connection.instance_name}
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-0 align-middle dark:border-gray-700">
                      {formatPhoneNumberDisplay(connection.phone_number || '')}
                    </td>
                    <td className="border border-[#e0e0e0] px-2 py-0 text-center align-middle dark:border-gray-700">
                       {getStatusBadge(connection.status)}
                    </td>
                    {userRole === 'master' && (
                      <td className="border border-[#e0e0e0] px-2 py-0 text-center align-middle dark:border-gray-700">
                          {connection.provider?.provider === 'zapi' ? (
                            <span className="flex items-center justify-center gap-1 text-[10px] font-medium text-blue-600">
                              <Zap className="w-3 h-3" /> Z-API
                            </span>
                          ) : (
                            <span className="flex items-center justify-center gap-1 text-[10px] font-medium text-purple-600">
                              <Cloud className="w-3 h-3" /> Evolution
                            </span>
                          )}
                      </td>
                    )}
                    <td className="border border-[#e0e0e0] px-1 py-0 text-center align-middle dark:border-gray-700">
                       <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDefaultConnection(connection)}
                          disabled={isSettingDefault}
                          className="h-6 w-6 p-0 mx-auto"
                          title="Definir como conexão padrão"
                        >
                          <Star 
                            className={`w-3.5 h-3.5 transition-colors ${
                              connection.is_default 
                                ? 'fill-yellow-500 text-yellow-500' 
                                : 'text-muted-foreground/30 hover:text-muted-foreground'
                            }`} 
                          />
                        </Button>
                    </td>
                    <td className="border border-[#e0e0e0] px-1 py-0 text-center align-middle dark:border-gray-700">
                      <div className="flex items-center justify-center gap-1 h-full">
                        {/* Connect/Disconnect/QR Buttons */}
                        {connection.status === 'connected' ? (
                            <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => disconnectInstance(connection)}
                            disabled={isDisconnecting}
                            className="h-6 w-6 rounded-sm hover:bg-red-100 text-red-600"
                            title="Desconectar"
                          >
                            <PowerOff className="h-3.5 w-3.5" />
                          </Button>
                        ) : (
                           <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => connectInstance(connection)}
                                disabled={isConnecting}
                                className="h-6 w-6 rounded-sm hover:bg-green-100 text-green-600"
                                title="Conectar / QR Code"
                              >
                                <QrCode className="h-3.5 w-3.5" />
                              </Button>
                              
                               {connection.provider?.provider === 'zapi' && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => refreshQRCode(connection.id)}
                                    disabled={isRefreshing}
                                    className="h-6 w-6 rounded-sm hover:bg-blue-100 text-blue-600"
                                    title="Atualizar QR Code"
                                  >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                  </Button>
                               )}
                           </>
                        )}

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(connection)}
                          className="h-6 w-6 rounded-sm hover:bg-blue-100 text-gray-600"
                          title="Editar"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openHistoryModal(connection)}
                          className="h-6 w-6 rounded-sm hover:bg-purple-100 text-purple-600"
                          title="Histórico de Conexões"
                        >
                          <History className="h-3.5 w-3.5" />
                        </Button>
                        
                        {userRole === 'master' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDeleteModal(connection)}
                            className="h-6 w-6 rounded-sm hover:bg-red-100 text-red-600"
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals Logic Kept */}
      <Dialog open={isQRModalOpen} onOpenChange={(open) => {
        if (!open) setSelectedConnection(null);
        setIsQRModalOpen(open);
      }}>
         <DialogContent className="max-w-4xl bg-white text-gray-900 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
          <DialogHeader className="px-4 py-2 bg-primary text-primary-foreground border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700">
            <DialogTitle className="text-xl font-semibold text-primary-foreground dark:text-gray-100 mb-2">
              Passos para conectar
            </DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 py-4">
             {/* Instruções à esquerda */}
            <div className="space-y-4">
               {/* Step 1 */}
               <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold text-sm">1</div>
                <div><p className="font-medium">Abra o <strong>WhatsApp</strong> no seu celular</p></div>
              </div>
               {/* Step 2 */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold text-sm">2</div>
                <div><p className="font-medium">No Android toque em <strong>Menu</strong> : ou no iPhone em <strong>Ajustes</strong></p></div>
              </div>
              {/* Step 3 */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold text-sm">3</div>
                <div><p className="font-medium">Toque em <strong>Dispositivos conectados</strong> e depois <strong>Conectar um dispositivo</strong></p></div>
              </div>
               {/* Step 4 */}
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground font-semibold text-sm">4</div>
                <div><p className="font-medium">Escaneie o QR Code à direita para confirmar</p></div>
              </div>
              <div className="pt-4">
                <Button 
                  onClick={() => selectedConnection && refreshQRCode(selectedConnection.id)}
                  variant="outline" 
                  size="sm"
                  disabled={isRefreshing}
                  className="w-full"
                >
                  {isRefreshing ? (
                    <><div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />Atualizando QR Code...</>
                  ) : (
                    <><RefreshCw className="w-4 h-4 mr-2" />Atualizar QR Code</>
                  )}
                </Button>
              </div>
            </div>
             {/* QR Code à direita */}
            <div className="flex items-center justify-center">
              {selectedConnection?.qr_code ? (
                <div className="text-center space-y-4">
                  <img 
                    src={selectedConnection.qr_code.replace(/^data:image\/png;base64,data:image\/png;base64,/, 'data:image/png;base64,')} 
                    alt="QR Code" 
                    className="mx-auto border border-border rounded-lg bg-white p-4"
                    style={{ width: '280px', height: '280px' }}
                  />
                  <p className="text-sm text-muted-foreground font-medium">{selectedConnection.instance_name}</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Gerando QR Code...</p>
                </div>
              )}
            </div>
          </div>
         </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <AlertDialog open={isDeleteModalOpen} onOpenChange={(open) => {
        setIsDeleteModalOpen(open);
        if (!open) setConfirmInstanceName('');
      }}>
        <AlertDialogContent className="max-w-lg bg-white text-gray-900 border border-[#d4d4d4] rounded-none shadow-xl dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-800">
          <AlertDialogHeader className="px-6 pt-5 pb-3 border-b border-[#d4d4d4] bg-[#f4b400] text-gray-900 dark:border-gray-900 dark:bg-[#f4b400] dark:text-gray-900">
            <AlertDialogTitle className="text-base font-semibold flex items-center gap-2">
              ⚠️ Confirmar Exclusão de Instância
            </AlertDialogTitle>
          </AlertDialogHeader>
          <div className="bg-red-50 text-red-800 dark:bg-[#161616] dark:text-gray-100 border-b border-[#d4d4d4] dark:border-gray-800 px-6 py-4 text-sm text-center leading-relaxed">
            A exclusão desta conexão é permanente e resultará na inativação imediata.<br />
            <span className="font-semibold">Importante:</span> mesmo após excluir, a assinatura Z-API continuará válida até o fim do ciclo atual.
          </div>
          <AlertDialogDescription className="space-y-4 px-6 py-4 text-gray-700 dark:text-gray-200">
              <div className="p-4 bg-gray-50 border border-[#d4d4d4] rounded-none dark:bg-[#131313] dark:border-gray-800">
                <p className="text-sm leading-relaxed">
                  A exclusão desta instância é permanente e resultará na inativação imediata da conexão. 
                  <span className="font-semibold"> Importante:</span> mesmo após excluir, a assinatura Z-API continuará válida até o fim do ciclo atual, 
                  gerando cobrança referente ao mês vigente. Caso realmente deseje prosseguir, digite o nome da instância para confirmar o cancelamento.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-instance" className="text-sm font-medium text-gray-900 dark:text-gray-100">Digite o nome da conexão para confirmar:</Label>
                <div className="p-2 bg-muted rounded border bg-gray-50 border-[#d4d4d4] dark:bg-[#131313] dark:border-gray-700">
                  <code className="text-sm font-mono">{connectionToDelete?.instance_name}</code>
                </div>
                <Input
                  id="confirm-instance"
                  value={confirmInstanceName}
                  onChange={(e) => setConfirmInstanceName(e.target.value)}
                  placeholder="Digite o nome da instância"
                  className="font-mono bg-white border-gray-300 text-gray-900 dark:bg-[#1a1a1a] dark:border-gray-700 dark:text-gray-100"
                />
              </div>
          </AlertDialogDescription>
          <AlertDialogFooter className="px-6 pb-6 pt-0 border-t border-[#d4d4d4] bg-[#f4f4f4] flex flex-row justify-end gap-2 dark:bg-[#0b0b0b] dark:border-gray-800">
            <AlertDialogCancel onClick={() => setConfirmInstanceName('')} className="h-9 px-5 rounded-none border border-gray-300 bg-white hover:bg-gray-100 dark:border-gray-700 dark:bg-[#1a1a1a] dark:text-gray-100 dark:hover:bg-[#222]">Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={removeConnection}
              disabled={userRole !== 'master' || isDisconnecting || confirmInstanceName !== connectionToDelete?.instance_name}
              className="h-9 px-5 rounded-none bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 dark:bg-red-600 dark:hover:bg-red-700"
            >
              {isDisconnecting ? 'Excluindo...' : 'Excluir Conexão'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Modal de Configuração de Webhooks Z-API */}
      {connectionToConfigureWebhook && (
        <ConfigureZapiWebhookModal
          isOpen={isConfigureWebhookModalOpen}
          onClose={() => {
            setIsConfigureWebhookModalOpen(false);
            setConnectionToConfigureWebhook(null);
          }}
          connectionId={connectionToConfigureWebhook.id}
          instanceName={connectionToConfigureWebhook.instance_name}
        />
      )}

      {/* Modal de Histórico de Conexões */}
      <Dialog open={isHistoryModalOpen} onOpenChange={(open) => {
        if (!open) {
          setHistoryConnection(null);
          setConnectionHistory([]);
        }
        setIsHistoryModalOpen(open);
      }}>
        <DialogContent className="max-w-3xl max-h-[80vh] bg-white text-gray-900 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700 sm:rounded-none">
          <DialogHeader className="px-4 py-2 bg-primary text-primary-foreground dark:text-white border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700">
            <DialogTitle className="text-primary-foreground dark:text-white flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico de Conexão/Desconexão
            </DialogTitle>
            <div className="text-sm text-primary-foreground/90 dark:text-white/90">
              {historyConnection?.instance_name} - Auditoria de status
            </div>
          </DialogHeader>

          <div className="overflow-auto max-h-[60vh] p-4">
            {isLoadingHistory ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : connectionHistory.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nenhum registro de histórico encontrado para esta conexão.
              </div>
            ) : (
              <table className="min-w-full border-collapse text-xs">
                <thead className="bg-[#f3f3f3] sticky top-0 dark:bg-[#1f1f1f]">
                  <tr>
                    <th className="border border-[#d4d4d4] px-3 py-2 text-left font-semibold dark:border-gray-700">Data/Hora</th>
                    <th className="border border-[#d4d4d4] px-3 py-2 text-left font-semibold dark:border-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {connectionHistory.map((record, index) => (
                    <tr key={record.id || index} className="hover:bg-blue-50 dark:hover:bg-[#1f2937]">
                      <td className="border border-[#e0e0e0] px-3 py-2 dark:border-gray-700 whitespace-nowrap">
                        {record.created_at ? new Date(record.created_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        }) : '-'}
                      </td>
                      <td className="border border-[#e0e0e0] px-3 py-2 dark:border-gray-700">
                        {record.status === 'connected' ? 'Conectado' : record.status === 'disconnected' ? 'Desconectado' : record.status || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <DialogFooter className="pt-2 border-t border-[#d4d4d4] dark:border-gray-700 bg-[#f7f7f7] dark:bg-[#111111]">
            <Button 
              variant="outline" 
              onClick={() => setIsHistoryModalOpen(false)} 
              className="rounded-none border border-[#d4d4d4] text-gray-800 bg-white hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:bg-transparent dark:hover:bg-[#1f1f1f]"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
