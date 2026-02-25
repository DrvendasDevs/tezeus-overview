import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { usePipelineRealtime } from '@/hooks/usePipelineRealtime';
import { generateRandomId } from '@/lib/generate-random-id';

const IS_DEV = false; // Desabilitado para evitar logs em excesso
const devLog = (...args: any[]) => {
  if (IS_DEV) console.log(...args);
};
const devWarn = (...args: any[]) => {
  if (IS_DEV) console.warn(...args);
};

const parseFunctionErrorBody = (error: any) => {
  const body = error?.context?.body;

  if (!body) return null;

  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch (parseError) {
      devWarn('⚠️ [PipelinesContext] Falha ao analisar corpo de erro da função:', parseError, body);
      return null;
    }
  }

  if (typeof body === 'object') {
    // Em alguns casos o supabase-js coloca um ReadableStream aqui
    // (não dá para ler de forma síncrona). Tratamos como "sem body".
    try {
      if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) {
        return null;
      }
    } catch {
      // ignore
    }
    return body;
  }

  return null;
};

// Alguns erros do supabase-js chegam com body como ReadableStream (não parseável de forma síncrona).
// Este helper lê a response/body e tenta extrair { error, message, details } para exibir no toast.
async function readFunctionErrorBodyAsync(error: any): Promise<any | null> {
  try {
    const ctx: any = error?.context;

    // 1) Tentar body direto (string/object)
    const direct = parseFunctionErrorBody(error);
    if (direct) return direct;

    // 2) Se body vier como ReadableStream
    const body = ctx?.body;
    try {
      if (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream) {
        const text = await new Response(body).text();
        try {
          return JSON.parse(text);
        } catch {
          return { message: text };
        }
      }
    } catch {
      // ignore
    }

    // 3) Tentar response (clonando para não consumir)
    const res: Response | undefined = ctx?.response;
    if (res) {
      const text = await (res.clone ? res.clone().text() : res.text());
      try {
        return JSON.parse(text);
      } catch {
        return { message: text };
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export interface Pipeline {
  id: string;
  workspace_id: string;
  name: string;
  type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineColumn {
  id: string;
  pipeline_id: string;
  name: string;
  color: string;
  icon?: string;
  order_position: number;
  created_at: string;
  permissions?: string[]; // Array de user_ids que podem ver esta coluna
  view_all_deals_permissions?: string[]; // Array de user_ids que podem ver todos os negócios desta coluna
  is_offer_stage?: boolean; // etapa de oferta
}

export interface PipelineCard {
  id: string;
  pipeline_id: string;
  column_id: string;
  conversation_id: string | null;
  contact_id: string | null;
  title: string;
  description: string | null;
  value: number;
  status: string;
  tags: any[];
  created_at: string;
  updated_at: string;
  responsible_user_id?: string;
  responsible_user?: {
    id: string;
    name: string;
  };
  contact?: any;
  conversation?: any;
  products?: Array<{
    id: string;
    product_id: string | null;
    quantity: number;
    unit_value: number;
    total_value: number;
    product?: {
      id: string;
      name: string;
      value: number;
    };
  }>;
}

interface PipelinesContextType {
  pipelines: Pipeline[];
  selectedPipeline: Pipeline | null;
  columns: PipelineColumn[];
  cards: PipelineCard[];
  isLoading: boolean;
  isLoadingColumns: boolean;
  isLoadingCards: boolean;
  isInitializingBoard: boolean;
  isLoadingInitialCardsByColumn: Record<string, boolean>;
  isAllColumnsLoaded: boolean;
  hasMoreCardsByColumn: Record<string, boolean>;
  isLoadingMoreCardsByColumn: Record<string, boolean>;
  totalCardsByColumn: Record<string, number>;
  fetchPipelines: () => Promise<void>;
  createPipeline: (name: string, type: string) => Promise<Pipeline>;
  deletePipeline: (pipelineId: string) => Promise<void>;
  selectPipeline: (pipeline: Pipeline) => void;
  refreshCurrentPipeline: () => Promise<void>;
  createColumn: (name: string, color: string, icon?: string) => Promise<PipelineColumn>;
  createCard: (cardData: Partial<PipelineCard>) => Promise<PipelineCard>;
  updateCard: (cardId: string, updates: Partial<PipelineCard>) => Promise<void>;
  moveCard: (cardId: string, newColumnId: string) => Promise<void>;
  moveCardOptimistic: (cardId: string, newColumnId: string) => Promise<void>;
  fetchMoreCards: (columnId: string) => Promise<void>;
  getCardsByColumn: (columnId: string) => PipelineCard[];
  reorderColumns: (newColumns: PipelineColumn[]) => Promise<void>;
  updateConversationAgentStatus: (conversationId: string, agente_ativo: boolean, agent_active_id?: string | null) => void;
}

export const PipelinesContext = createContext<PipelinesContextType | undefined>(undefined);

export function PipelinesProvider({ children }: { children: React.ReactNode }) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [cards, setCards] = useState<PipelineCard[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Start as loading
  const [isLoadingColumns, setIsLoadingColumns] = useState(false);
  const [isLoadingCards, setIsLoadingCards] = useState(false);
  const [isLoadingInitialCardsByColumn, setIsLoadingInitialCardsByColumn] = useState<Record<string, boolean>>({});
  const [isAllColumnsLoaded, setIsAllColumnsLoaded] = useState(false); // Todas as colunas carregadas juntas
  const [isInitializingBoard, setIsInitializingBoard] = useState(true); // 🚀 Estado unificado: true até pipeline+colunas+cards estarem prontos
  const [cardsOffsetByColumn, setCardsOffsetByColumn] = useState<Record<string, number>>({});
  const [hasMoreCardsByColumn, setHasMoreCardsByColumn] = useState<Record<string, boolean>>({});
  const [isLoadingMoreCardsByColumn, setIsLoadingMoreCardsByColumn] = useState<Record<string, boolean>>({});
  const [totalCardsByColumn, setTotalCardsByColumn] = useState<Record<string, number>>({});
  const { selectedWorkspace } = useWorkspace();
  const { toast } = useToast();
  const { user, userRole } = useAuth();
  const PAGE_SIZE = 10;
  
  // 🔥 Ref para armazenar timeouts pendentes de movimentação de cards
  const pendingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // 🚀 Cache de sessão para evitar re-fetches desnecessários
  const lastFetchedPipelineRef = useRef<string | null>(null);
  const isFetchingCardsRef = useRef<boolean>(false);
  const cardsLoadedAtRef = useRef<number>(0);

  // 🚀 Refs estáveis para funções de fetch (evita dependências circulares nos effects)
  const fetchColumnsRef = useRef<((pipelineId: string) => Promise<PipelineColumn[] | null>)>(null as any);
  const fetchCardsRef = useRef<((pipelineId: string, cols: PipelineColumn[], forceRefresh?: boolean) => Promise<void>)>(null as any);
  const fetchPipelinesRef = useRef<((forceSelectFirst?: boolean) => Promise<void>)>(null as any);
  const fetchBoardDataRef = useRef<((pipelineId: string, forceRefresh?: boolean) => Promise<void>)>(null as any);
  const cardsRef = useRef<PipelineCard[]>([]);

  // 🚀 Guard: evitar reinicialização quando o workspace não mudou (ex: navegação entre abas)
  const lastInitializedWorkspaceRef = useRef<string | null>(null);

  // Estabilizar a função getHeaders para evitar re-renders desnecessários
  const getHeaders = useMemo(() => {
    if (!selectedWorkspace?.workspace_id) {
      return null;
    }
    
    const userData = localStorage.getItem('currentUser');
    const currentUserData = userData ? JSON.parse(userData) : null;
    
    if (!currentUserData?.id) {
      return null;
    }

    const headers = {
      'x-system-user-id': currentUserData.id,
      'x-system-user-email': currentUserData.email || '',
      'x-workspace-id': selectedWorkspace.workspace_id
    };
    
    return headers;
  }, [selectedWorkspace?.workspace_id]);

  const fetchPipelines = useCallback(async (forceSelectFirst = false) => {
    if (!getHeaders) {
      setIsLoading(false);
      setIsInitializingBoard(false);
      return;
    }
    
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase.functions.invoke('pipeline-management/pipelines', {
        method: 'GET',
        headers: getHeaders
      });

      if (error) {
        console.error('❌ Pipeline fetch error:', error);
        throw error;
      }

      // Ordenar pipelines: pipeline padrão do workspace primeiro, depois por created_at desc
      let sortedPipelines = data || [];
      if (sortedPipelines.length > 0) {
        const defaultPipelineId: string | null = selectedWorkspace?.default_pipeline_id ?? null;
        
        if (defaultPipelineId) {
          const defaultPipeline = sortedPipelines.find(p => p.id === defaultPipelineId);
          if (defaultPipeline) {
            // Remover a pipeline padrão da lista e colocá-la no início
            sortedPipelines = [
              defaultPipeline,
              ...sortedPipelines.filter(p => p.id !== defaultPipelineId)
            ];
          }
        }
      }

      setPipelines(sortedPipelines);
      
      // Auto-select sem depender de closure (evita re-render/loop em effects que dependem de fetchPipelines)
      if (sortedPipelines.length > 0) {
        setSelectedPipeline((prev) => {
          const defaultPipelineId: string | null = selectedWorkspace?.default_pipeline_id ?? null;
          const defaultPipeline = defaultPipelineId
            ? sortedPipelines.find((p) => p.id === defaultPipelineId)
            : null;

          // Se existe pipeline padrão no workspace, priorizar ele no carregamento.
          if (defaultPipeline) return defaultPipeline;
          if (forceSelectFirst) return sortedPipelines[0];
          if (!prev) return sortedPipelines[0];
          const stillExists = sortedPipelines.some((p) => p.id === prev.id);
          return stillExists ? prev : sortedPipelines[0];
        });
      } else {
        // Sem pipelines → board não tem o que renderizar
        setIsInitializingBoard(false);
      }
    } catch (error) {
      console.error('❌ Error fetching pipelines:', error);
      setIsInitializingBoard(false);
      toast({
        title: "Erro",
        description: "Erro ao carregar pipelines. Verifique sua conexão.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [getHeaders, toast, selectedWorkspace?.workspace_id, selectedWorkspace?.default_pipeline_id]);

  const fetchColumns = useCallback(async (pipelineId: string): Promise<PipelineColumn[] | null> => {
    if (!getHeaders || !pipelineId) return null;

    try {
      setIsLoadingColumns(true);
      const { data, error } = await supabase.functions.invoke(`pipeline-management/columns?pipeline_id=${pipelineId}`, {
        method: 'GET',
        headers: getHeaders
      });

      if (error) throw error;
      
      // Normalizar view_all_deals_permissions para array de strings
      const normalizedColumns = (data || []).map((col: any) => {
        const permissions = Array.isArray(col.view_all_deals_permissions) 
          ? col.view_all_deals_permissions.map((p: any) => String(p)).filter(Boolean)
          : [];
        
        // Log de debug para verificar permissões carregadas
        if (permissions.length > 0) {
          devLog('📋 [fetchColumns] Coluna com permissões:', {
            columnId: col.id,
            columnName: col.name,
            permissions,
          });
        }
        
        return {
          ...col,
          view_all_deals_permissions: permissions
        };
      });
      
      setColumns(normalizedColumns);
      return normalizedColumns;
    } catch (error) {
      console.error('Error fetching columns:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar colunas",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoadingColumns(false);
    }
  }, [getHeaders, toast]);

  const isCardVisibleForUser = useCallback((card: any) => {
    // Regra de produto: no pipeline, mostrar apenas negócios em ABERTO ou PERDIDO.
    // (Ganho continua existindo no banco e aparece apenas em histórico/relatórios.)
    const status = String(card?.status || '').toLowerCase().trim();
    const isVisibleStatus = status === 'aberto' || status === 'perda' || status === 'perdido';
    if (!isVisibleStatus) return false;

    if (userRole !== 'user') return true;

    const userData = localStorage.getItem('currentUser');
    const currentUserData = userData ? JSON.parse(userData) : null;
    const currentUserId = currentUserData?.id;
    const responsibleId = card?.responsible_user_id || card?.responsible_user?.id || null;
    const isUnassigned = !responsibleId;
    const isAssignedToCurrentUser = responsibleId === currentUserId;
    return isUnassigned || isAssignedToCurrentUser;
  }, [userRole]);

  const fetchCardsPage = useCallback(async (opts: {
    pipelineId: string;
    columnId: string;
    offset: number;
    append: boolean;
  }) => {
    if (!getHeaders) return;

    const { pipelineId, columnId, offset, append } = opts;
    const limit = PAGE_SIZE + 1; // client infers hasMore by requesting 10+1

    const { data, error } = await supabase.functions.invoke(
      `pipeline-management/cards?pipeline_id=${pipelineId}&column_id=${columnId}&limit=${limit}&offset=${offset}&lite=1`,
      {
        method: 'GET',
        headers: getHeaders,
      }
    );

    if (error) throw error;

    const raw: any[] = Array.isArray(data) ? data : [];
    const hasMore = raw.length > PAGE_SIZE;
    const rawPage = hasMore ? raw.slice(0, PAGE_SIZE) : raw;
    const visiblePage = rawPage.filter(isCardVisibleForUser);

    // Atualizar paginação baseada no conjunto "bruto" (DB paging), não no filtrado
    setCardsOffsetByColumn((prev) => ({
      ...prev,
      [columnId]: offset + rawPage.length,
    }));
    setHasMoreCardsByColumn((prev) => ({
      ...prev,
      [columnId]: hasMore,
    }));

    // Mesclar cards
    setCards((prev) => {
      const incomingIds = new Set(visiblePage.map((c) => c.id));
      const base = prev.filter((c) => !incomingIds.has(c.id));

      if (!append) {
        const baseWithoutColumn = base.filter((c) => c.column_id !== columnId);
        return [...baseWithoutColumn, ...(visiblePage as any)];
      }

      return [...base, ...(visiblePage as any)];
    });

    // Marcar coluna como "carregada" na primeira página
    if (!append) {
      setIsLoadingInitialCardsByColumn((prev) => ({ ...prev, [columnId]: false }));
    }
  }, [PAGE_SIZE, getHeaders, isCardVisibleForUser]);

  // Função para buscar a contagem total de cards por coluna (sem paginação)
  const fetchTotalCardsCounts = useCallback(async (pipelineId: string, cols: PipelineColumn[]) => {
    if (!pipelineId || cols.length === 0) {
      setTotalCardsByColumn({});
      return;
    }

    try {
      // Buscar contagem de cards por coluna usando query direta
      const { data, error } = await supabase
        .from('pipeline_cards')
        .select('column_id', { count: 'exact', head: false })
        .eq('pipeline_id', pipelineId);

      if (error) {
        console.error('❌ Erro ao buscar contagem de cards:', error);
        return;
      }

      // Contar cards por coluna
      const counts: Record<string, number> = {};
      cols.forEach(col => {
        counts[col.id] = 0;
      });
      
      if (data) {
        data.forEach((card: any) => {
          if (card.column_id && counts[card.column_id] !== undefined) {
            counts[card.column_id]++;
          }
        });
      }

      setTotalCardsByColumn(counts);
      devLog('📊 [fetchTotalCardsCounts] Contagem total por coluna:', counts);
    } catch (err) {
      console.error('❌ Erro ao buscar contagem total de cards:', err);
    }
  }, []);

  const fetchCards = useCallback(async (pipelineId: string, cols: PipelineColumn[], forceRefresh = false) => {
    if (!getHeaders || !pipelineId) return;

    const effectiveColumns = Array.isArray(cols) ? cols : [];
    if (!effectiveColumns || effectiveColumns.length === 0) {
      setCards([]);
      setCardsOffsetByColumn({});
      setHasMoreCardsByColumn({});
      setIsLoadingMoreCardsByColumn({});
      setIsLoadingCards(false);
      return;
    }

    // 🚀 Evitar re-fetch se já temos dados recentes (menos de 5 segundos)
    const now = Date.now();
    const timeSinceLastFetch = now - cardsLoadedAtRef.current;
    const isSamePipeline = lastFetchedPipelineRef.current === pipelineId;
    
    if (!forceRefresh && isSamePipeline && cardsRef.current.length > 0 && timeSinceLastFetch < 5000) {
      devLog('🚀 [fetchCards] Usando cache (dados recentes, mesmo pipeline)');
      return;
    }

    // 🚀 Evitar requisições simultâneas
    if (isFetchingCardsRef.current) {
      devLog('🚀 [fetchCards] Já existe um fetch em andamento, ignorando');
      return;
    }

    isFetchingCardsRef.current = true;

    // Reset pagination state for current columns
    const initOffsets: Record<string, number> = {};
    const initHasMore: Record<string, boolean> = {};
    const initInitialLoading: Record<string, boolean> = {};
    effectiveColumns.forEach((c) => {
      initOffsets[c.id] = 0;
      initHasMore[c.id] = true;
      initInitialLoading[c.id] = true;
    });

    setCards([]);
    setCardsOffsetByColumn(initOffsets);
    setHasMoreCardsByColumn(initHasMore);
    setIsLoadingMoreCardsByColumn({});
    setIsLoadingInitialCardsByColumn(initInitialLoading);
    setIsAllColumnsLoaded(false); // Marcar como não carregado

    try {
      setIsLoadingCards(true);
      // Buscar cards paginados e contagem total em paralelo
      await Promise.all([
        // Buscar primeira página de cada coluna
        ...effectiveColumns.map((col) =>
          fetchCardsPage({
            pipelineId,
            columnId: col.id,
            offset: 0,
            append: false,
          })
        ),
        // Buscar contagem total de cards por coluna
        fetchTotalCardsCounts(pipelineId, effectiveColumns)
      ]);
      
      // Após todas as colunas carregarem, marcar como carregado
      setIsAllColumnsLoaded(true);
      
      // 🚀 Atualizar cache refs
      lastFetchedPipelineRef.current = pipelineId;
      cardsLoadedAtRef.current = Date.now();
    } catch (error) {
      const parsedError = await readFunctionErrorBodyAsync(error);
      console.error('❌ [fetchCards] Erro ao buscar cards (paginado):', { error, parsedError });
      console.error('❌ [fetchCards] Erro ao buscar cards (paginado):', error);
      toast({
        title: "Erro",
        description:
          parsedError?.message ||
          parsedError?.error ||
          "Erro ao carregar cards. Tente recarregar a página.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCards(false);
      isFetchingCardsRef.current = false;
    }
  }, [getHeaders, fetchCardsPage, fetchTotalCardsCounts, toast]);

  // ==========================================================================
  // 🚀🚀🚀 FETCH UNIFICADO DO BOARD (1 única chamada HTTP → RPC get_pipeline_board)
  // Substitui fetchColumns + N × fetchCardsPage + fetchTotalCardsCounts
  // ==========================================================================
  const fetchBoardData = useCallback(async (pipelineId: string, forceRefresh = false) => {
    if (!getHeaders || !pipelineId) return;

    // 🚀 Evitar re-fetch se já temos dados recentes (menos de 5 segundos)
    const now = Date.now();
    const timeSinceLastFetch = now - cardsLoadedAtRef.current;
    const isSamePipeline = lastFetchedPipelineRef.current === pipelineId;

    if (!forceRefresh && isSamePipeline && cardsRef.current.length > 0 && timeSinceLastFetch < 5000) {
      devLog('🚀 [fetchBoardData] Usando cache (dados recentes, mesmo pipeline)');
      setIsInitializingBoard(false);
      return;
    }

    // 🚀 Evitar requisições simultâneas
    if (isFetchingCardsRef.current) {
      devLog('🚀 [fetchBoardData] Já existe um fetch em andamento, ignorando');
      return;
    }

    isFetchingCardsRef.current = true;

    try {
      devLog('🚀 [fetchBoardData] Iniciando fetch unificado para pipeline:', pipelineId);

      const { data, error } = await supabase.functions.invoke(
        `pipeline-management/board?pipeline_id=${pipelineId}&limit=${PAGE_SIZE + 1}`,
        {
          method: 'GET',
          headers: getHeaders,
        }
      );

      if (error) throw error;

      const boardColumns: any[] = data?.columns || [];
      const boardCards: any[] = data?.cards || [];
      const boardCounts: Record<string, number> = data?.counts || {};

      // ---- COLUNAS: normalizar view_all_deals_permissions ----
      const normalizedColumns: PipelineColumn[] = boardColumns.map((col: any) => {
        const permissions = Array.isArray(col.view_all_deals_permissions)
          ? col.view_all_deals_permissions.map((p: any) => String(p)).filter(Boolean)
          : [];
        return { ...col, view_all_deals_permissions: permissions };
      });

      // ---- CARDS: separar por coluna e aplicar lógica de paginação ----
      const cardsByCol: Record<string, any[]> = {};
      normalizedColumns.forEach(c => { cardsByCol[c.id] = []; });
      boardCards.forEach((card: any) => {
        if (cardsByCol[card.column_id]) {
          cardsByCol[card.column_id].push(card);
        }
      });

      const initOffsets: Record<string, number> = {};
      const initHasMore: Record<string, boolean> = {};
      const initInitialLoading: Record<string, boolean> = {};
      const allVisibleCards: PipelineCard[] = [];

      normalizedColumns.forEach((col) => {
        const colCards = cardsByCol[col.id] || [];
        const hasMore = colCards.length > PAGE_SIZE;
        const rawPage = hasMore ? colCards.slice(0, PAGE_SIZE) : colCards;
        const visiblePage = rawPage.filter(isCardVisibleForUser);

        initOffsets[col.id] = rawPage.length;
        initHasMore[col.id] = hasMore;
        initInitialLoading[col.id] = false;

        allVisibleCards.push(...(visiblePage as PipelineCard[]));
      });

      // ---- APLICAR TUDO DE UMA VEZ (batch setState minimiza re-renders) ----
      setColumns(normalizedColumns);
      setCards(allVisibleCards);
      setCardsOffsetByColumn(initOffsets);
      setHasMoreCardsByColumn(initHasMore);
      setIsLoadingMoreCardsByColumn({});
      setIsLoadingInitialCardsByColumn(initInitialLoading);
      setTotalCardsByColumn(boardCounts);
      setIsAllColumnsLoaded(true);

      // 🚀 Atualizar cache refs
      lastFetchedPipelineRef.current = pipelineId;
      cardsLoadedAtRef.current = Date.now();

      devLog('✅ [fetchBoardData] Board carregado:', {
        columns: normalizedColumns.length,
        cards: allVisibleCards.length,
        counts: boardCounts,
      });
    } catch (error) {
      const parsedError = await readFunctionErrorBodyAsync(error);
      console.error('❌ [fetchBoardData] Erro ao buscar board unificado:', { error, parsedError });
      toast({
        title: "Erro",
        description:
          parsedError?.message ||
          parsedError?.error ||
          "Erro ao carregar o board. Tente recarregar a página.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingColumns(false);
      setIsLoadingCards(false);
      isFetchingCardsRef.current = false;
    }
  }, [getHeaders, isCardVisibleForUser, toast]);

  const fetchMoreCards = useCallback(async (columnId: string) => {
    if (!selectedPipeline?.id || !getHeaders) return;

    const hasMore = hasMoreCardsByColumn[columnId];
    if (hasMore === false) return;
    if (isLoadingMoreCardsByColumn[columnId]) return;

    const offset = cardsOffsetByColumn[columnId] || 0;

    try {
      setIsLoadingMoreCardsByColumn((prev) => ({ ...prev, [columnId]: true }));
      await fetchCardsPage({
        pipelineId: selectedPipeline.id,
        columnId,
        offset,
        append: true,
      });
    } catch (error) {
      console.error('❌ [fetchMoreCards] Erro ao buscar mais cards:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar mais cards. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMoreCardsByColumn((prev) => ({ ...prev, [columnId]: false }));
    }
  }, [
    selectedPipeline?.id,
    getHeaders,
    hasMoreCardsByColumn,
    isLoadingMoreCardsByColumn,
    cardsOffsetByColumn,
    fetchCardsPage,
    toast,
  ]);

  const createPipeline = useCallback(async (name: string, type: string) => {
    if (!getHeaders) throw new Error('Headers not available');
    
    try {
      const { data, error } = await supabase.functions.invoke('pipeline-management/pipelines', {
        method: 'POST',
        headers: getHeaders,
        body: { name, type }
      });

      if (error) throw error;

      setPipelines(prev => [data, ...prev]);
      setSelectedPipeline(data);
      
      toast({
        title: "Sucesso",
        description: "Pipeline criado com sucesso",
      });

      return data;
    } catch (error) {
      console.error('Error creating pipeline:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar pipeline",
        variant: "destructive",
      });
      throw error;
    }
  }, [getHeaders, toast]);

  const deletePipeline = useCallback(async (pipelineId: string) => {
    if (!getHeaders) throw new Error('Headers não disponíveis');

    const { data, error } = await supabase.functions.invoke(
      `pipeline-management/pipelines?id=${pipelineId}`,
      {
        method: 'DELETE',
        headers: getHeaders
      }
    );

    if (error) {
      console.error('❌ Erro ao deletar pipeline:', error);
      throw error;
    }

    devLog('✅ Pipeline deletado com sucesso');
    
    // Atualizar lista de pipelines
    await fetchPipelines();
    
    // Se era o pipeline selecionado, limpar seleção
    if (selectedPipeline?.id === pipelineId) {
      setSelectedPipeline(null);
      setColumns([]);
      setCards([]);
    }

    toast({
      title: "Pipeline excluído",
      description: "O pipeline foi excluído com sucesso.",
    });
  }, [getHeaders, toast, fetchPipelines, selectedPipeline]);

  const selectPipeline = useCallback((pipeline: Pipeline) => {
    setIsInitializingBoard(true); // 🚀 Loading unificado: um único spinner
    setSelectedPipeline(pipeline);
    // Limpar colunas/cards ao trocar pipeline
    setColumns([]);
    setCards([]);
  }, []);

  // 🚀 Refresh do pipeline usando fetch unificado (1 chamada HTTP)
  const refreshCurrentPipeline = useCallback(async () => {
    if (selectedPipeline?.id) {
      await fetchBoardDataRef.current(selectedPipeline.id, true); // forceRefresh = true
    }
  }, [selectedPipeline?.id]);

  const createColumn = useCallback(async (name: string, color: string, icon: string = 'Circle') => {
    if (!getHeaders || !selectedPipeline) throw new Error('Requirements not met');

    try {
      const { data, error } = await supabase.functions.invoke('pipeline-management/columns', {
        method: 'POST',
        headers: getHeaders,
        body: { 
          pipeline_id: selectedPipeline.id,
          name,
          color,
          icon
        }
      });

      if (error) throw error;

      setColumns(prev => [...prev, data]);
      
      toast({
        title: "Sucesso",
        description: "Coluna criada com sucesso",
      });

      return data;
    } catch (error) {
      console.error('Error creating column:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar coluna",
        variant: "destructive",
      });
      throw error;
    }
  }, [getHeaders, selectedPipeline, toast]);

  const createCard = useCallback(async (cardData: Partial<PipelineCard>) => {
    if (!getHeaders || !selectedPipeline) throw new Error('Requirements not met');

    // Criar card otimista imediatamente no front-end
    const tempCardId = generateRandomId();
    const optimisticCard: PipelineCard = {
      id: tempCardId,
      pipeline_id: selectedPipeline.id,
      column_id: cardData.column_id!,
      conversation_id: cardData.conversation_id || null,
      contact_id: cardData.contact_id || null,
      title: cardData.title || 'Novo card',
      description: cardData.description || null,
      value: cardData.value || 0,
      status: 'aberto',
      tags: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      responsible_user_id: cardData.responsible_user_id,
      // Incluir dados do contato se fornecidos
      contact: (cardData as any).contact || null
    };

    // Adicionar card otimista imediatamente
    setCards(prev => [optimisticCard, ...prev]);

    try {
      devLog('🎯 Criando card no backend:', {
        pipeline_id: selectedPipeline.id,
        cardData
      });

      // Remover dados extras que não devem ir para o backend
      const { contact, ...backendCardData } = cardData as any;

      const { data, error } = await supabase.functions.invoke('pipeline-management/cards', {
        method: 'POST',
        headers: getHeaders,
        body: {
          pipeline_id: selectedPipeline.id,
          ...backendCardData
        }
      });

      if (error) {
        const parsedError: any = await readFunctionErrorBodyAsync(error);
        console.error('❌ Erro ao criar card no backend:', {
          error,
          parsedError
        });
        // Remover card otimista em caso de erro
        setCards(prev => prev.filter(c => c.id !== tempCardId));

        // Marcar como já tratado para evitar toasts duplicados em camadas acima/abaixo
        try {
          (error as any).__pipeline_create_handled = true;
          (error as any).__pipeline_create_parsed = parsedError || null;
        } catch {
          // ignore
        }
        
        // Verificar se é erro de card duplicado
        if (error.message?.includes('Já existe um card aberto') || 
            error.message?.includes('duplicate_open_card') ||
            parsedError?.error === 'duplicate_open_card') {
          toast({
            title: "Negócio já existe",
            description:
              parsedError?.message ||
              "Este contato já possui um negócio aberto neste pipeline. Finalize o anterior antes de criar um novo.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Erro",
            description: parsedError?.message || parsedError?.error || "Erro ao criar card",
            variant: "destructive",
          });
        }
        
        throw error;
      }

      // Substituir card temporário pelo real retornado do backend
      setCards(prev => prev.map(c => c.id === tempCardId ? data : c));
      
      toast({
        title: "Sucesso",
        description: "Card criado com sucesso",
      });

      return data;
    } catch (error: any) {
      // Se já tratamos o erro acima (branch do supabase.functions.invoke), não repetir toast aqui
      if ((error as any)?.__pipeline_create_handled) {
        throw error;
      }

      // Garantir remoção do card otimista em qualquer erro inesperado
      setCards(prev => prev.filter(c => c.id !== tempCardId));

      const parsedError = await readFunctionErrorBodyAsync(error);
      console.error('❌ Error creating card:', { error, parsedError });
      
      // Verificar se é erro de card duplicado (do trigger do banco)
      const isDuplicate =
        error?.message?.includes('Já existe um card aberto') ||
        error?.message?.includes('duplicate_open_card') ||
        parsedError?.error === 'duplicate_open_card';

        toast({
        title: isDuplicate ? "Negócio já existe" : "Erro",
        description:
          parsedError?.message ||
          parsedError?.error ||
          (isDuplicate
            ? "Este contato já possui um negócio aberto neste pipeline. Finalize o anterior antes de criar um novo."
            : "Erro ao criar card"),
          variant: "destructive",
        });

      try {
        (error as any).__pipeline_create_handled = true;
        (error as any).__pipeline_create_parsed = parsedError || null;
      } catch {
        // ignore
      }
      
      throw error;
    }
  }, [getHeaders, selectedPipeline, toast]);

  const updateCard = useCallback(async (cardId: string, updates: Partial<PipelineCard>) => {
    if (!getHeaders) throw new Error('Headers not available');

    try {
      const { data, error } = await supabase.functions.invoke(`pipeline-management/cards?id=${cardId}&lite=1`, {
        method: 'PUT',
        headers: getHeaders,
        body: updates
      });

      if (error) throw error;

      setCards(prev => {
        const next = prev.map(card => (card.id === cardId ? { ...card, ...data } : card));

        // Regra de produto: no pipeline só aparecem status ABERTO ou PERDIDO.
        // Se o status virou ganho, remover imediatamente do estado para sumir do pipeline sem precisar refetch.
        const nextStatus = String((data as any)?.status ?? (updates as any)?.status ?? '').toLowerCase().trim();
        const isVisibleStatus = nextStatus === 'aberto' || nextStatus === 'perda' || nextStatus === 'perdido';
        if (nextStatus && !isVisibleStatus) {
          return next.filter(c => c.id !== cardId);
        }

        return next;
      });

      // Se a atualização mudou a coluna, emitir broadcast como fallback
      if (updates.column_id && selectedPipeline?.id) {
        try {
          const channelName = `pipeline-${selectedPipeline.id}`;
          const existing = (supabase.getChannels?.() || []).find((c: any) => c?.topic === channelName);
          if (existing) {
            devLog('📡 [Broadcast] updateCard: enviando pipeline-card-moved via canal existente');
            const ok = await existing.send({
              type: 'broadcast',
              event: 'pipeline-card-moved',
              payload: { cardId, newColumnId: updates.column_id }
            });
            devLog('📡 [Broadcast] updateCard enviado:', ok);
          }
        } catch (err) {
          devWarn('⚠️ [Broadcast] updateCard: falha ao enviar broadcast', err);
        }
      }

      return data;
    } catch (error) {
      console.error('Error updating card:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar card",
        variant: "destructive",
      });
      throw error;
    }
  }, [getHeaders, toast]);

  const moveCard = useCallback(async (cardId: string, newColumnId: string) => {
    await updateCard(cardId, { column_id: newColumnId });
    // Se a coluna de destino for etapa de oferta, marca oferta=true no card
    const targetColumn = columns.find((c) => c.id === newColumnId);
    if (targetColumn?.is_offer_stage) {
      try {
        const { error: ofertaError } = await supabase
          .from('pipeline_cards')
          .update({ oferta: true })
          .eq('id', cardId);
        if (ofertaError) {
          console.error('Erro ao marcar oferta=true (moveCard):', ofertaError);
        }
      } catch (e) {
        console.error('Erro ao marcar oferta=true (moveCard):', e);
      }
    }
  }, [updateCard, columns]);

  const moveCardOptimistic = useCallback(async (cardId: string, newColumnId: string) => {
    const previousCards = [...cards];
    const cardToMove = cards.find(c => c.id === cardId);
    
    if (!cardToMove) return;

    devLog('🚀 [Optimistic] Movendo card instantaneamente:', {
      cardId,
      fromColumn: cardToMove.column_id,
      toColumn: newColumnId,
      timestamp: new Date().toISOString()
    });

    // Atualização otimista local (apenas visual)
    const optimisticTimestamp = new Date().toISOString();
    setCards(prev => prev.map(card => 
      card.id === cardId 
        ? { 
            ...card, 
            column_id: newColumnId, 
            updated_at: optimisticTimestamp 
          }
        : card
    ));

    try {
      if (!getHeaders) throw new Error('Headers not available');

      devLog('📤 [Optimistic] Enviando para backend...');
      
      const { data, error } = await supabase.functions.invoke(`pipeline-management/cards?id=${cardId}&lite=1`, {
        method: 'PUT',
        headers: getHeaders,
        body: { column_id: newColumnId }
      });

      if (error) throw error;

      devLog('✅ [Optimistic] Backend confirmou mudança');
      devLog('⏳ [Optimistic] Aguardando evento realtime...');

      // Se a coluna de destino for etapa de oferta, marcar oferta=true
      const targetColumn = columns.find((c) => c.id === newColumnId);
      if (targetColumn?.is_offer_stage) {
        try {
          const { error: ofertaError } = await supabase
            .from('pipeline_cards')
            .update({ oferta: true })
            .eq('id', cardId);
          if (ofertaError) {
            console.error('Erro ao marcar oferta=true (moveCardOptimistic):', ofertaError);
          }
        } catch (e) {
          console.error('Erro ao marcar oferta=true (moveCardOptimistic):', e);
        }
      }

      // Enviar broadcast manual para garantir atualização cross-aba mesmo se o evento do DB não chegar
      try {
        if (selectedPipeline?.id) {
          const channelName = `pipeline-${selectedPipeline.id}`;
          // Tentar reutilizar canal existente (criado pelo hook usePipelineRealtime)
          const existing = (supabase.getChannels?.() || []).find((c: any) => c?.topic === channelName);
          if (existing) {
            devLog('📡 [Broadcast] Usando canal existente para enviar pipeline-card-moved');
            const ok = await existing.send({
              type: 'broadcast',
              event: 'pipeline-card-moved',
              payload: { cardId, newColumnId }
            });
            devLog('📡 [Broadcast] Enviado via canal existente:', ok);
          } else {
            devLog('📡 [Broadcast] Canal inexistente, criando e assinando para enviar...');
            const tempChannel = supabase.channel(channelName, { config: { broadcast: { self: false } } });
            await tempChannel.subscribe();
            const ok = await tempChannel.send({
              type: 'broadcast',
              event: 'pipeline-card-moved',
              payload: { cardId, newColumnId }
            });
            devLog('📡 [Broadcast] Enviado via canal temporário:', ok);
            // Remover canal temporário após tentativa
            supabase.removeChannel(tempChannel);
          }
        }
      } catch (broadcastErr) {
        console.error('❌ [Broadcast] Falha ao enviar broadcast de movimento de card:', broadcastErr);
      }

      // O evento realtime vai atualizar o estado com o timestamp correto do banco
      // Não fazemos nada aqui para evitar duplicação

      // ✅ Cancelar timeout anterior se existir
      const existingTimeout = pendingTimeoutsRef.current.get(cardId);
      if (existingTimeout) {
        devLog('🚫 [Optimistic] Cancelando timeout anterior para card:', cardId);
        clearTimeout(existingTimeout);
      }

      // ✅ Timeout de segurança: se realtime não chegar em 3s, forçar atualização
      const timeoutId = setTimeout(() => {
        devWarn('⏰ [Realtime] Timeout - forçando atualização local');
        
        setCards(prev => prev.map(card => 
          card.id === cardId 
            ? { ...card, column_id: newColumnId }
            : card
        ));
        
        // Remover timeout da lista após execução
        pendingTimeoutsRef.current.delete(cardId);
      }, 3000);
      
      // Armazenar timeout para possível cancelamento
      pendingTimeoutsRef.current.set(cardId, timeoutId);

    } catch (error) {
      console.error('❌ [Optimistic] Erro - revertendo:', error);
      
      setCards(previousCards);
      
      toast({
        title: "Erro ao mover card",
        description: "O card foi retornado à posição original",
        variant: "destructive",
      });
    }
  }, [cards, getHeaders, toast]);

  const getCardsByColumn = useCallback((columnId: string) => {
    if (!selectedPipeline) return [];
    
    // Buscar informações do usuário atual
    const userData = localStorage.getItem('currentUser');
    const currentUserData = userData ? JSON.parse(userData) : null;
    const currentUserId = currentUserData?.id;
    
    // Buscar a coluna para verificar permissões
    const column = columns.find(col => col.id === columnId);
    
    // Verificar permissões com comparação mais robusta (string e UUID)
    const viewAllPermissions = column?.view_all_deals_permissions || [];
    const hasColumnPermission = viewAllPermissions.some((permUserId: string) => {
      // Comparar como string para garantir match
      return String(permUserId) === String(currentUserId);
    });
    
    // Log de debug
    if (userRole === 'user' && column) {
      devLog('🔍 [getCardsByColumn] Verificando permissões:', {
        columnId,
        columnName: column.name,
        currentUserId,
        viewAllPermissions,
        hasColumnPermission,
        totalCards: cards.filter(c => c.column_id === columnId).length
      });
    }
    
    // Primeiro filtra por coluna e permissões
    const filteredCards = cards.filter(card => {
      // Filtro básico por coluna
      if (card.column_id !== columnId) return false;
      
      // Se é um usuário comum (não master/admin), aplicar filtros de responsabilidade
      if (userRole === 'user') {
        // Se o usuário tem permissão para ver todos os negócios desta coluna, permitir acesso
        if (hasColumnPermission) {
          devLog('✅ [getCardsByColumn] Usuário tem permissão na coluna para ver todos os negócios:', {
            cardId: card.id,
            columnId,
            columnName: column?.name,
            currentUserId
          });
          return true;
        }
        
        // Caso contrário, aplicar regra padrão:
        // Usuários só podem ver:
        // 1. Cards não atribuídos (responsible_user_id é null/undefined)
        // 2. Cards atribuídos a eles mesmos
        const responsibleId = card.responsible_user_id || (card.responsible_user as any)?.id || null;
        const isUnassigned = !responsibleId;
        const isAssignedToCurrentUser = responsibleId === currentUserId;
        
        if (!isUnassigned && !isAssignedToCurrentUser) {
          devLog('🚫 [getCardsByColumn] Ocultando card para usuário comum:', {
            cardId: card.id,
            columnId,
            responsible_user_id: card.responsible_user_id,
            responsible_user: card.responsible_user,
            currentUserId
          });
          return false;
        }
      }
      
      return true;
    });

    // Deduplica apenas por ID (previne duplicatas reais de sincronização)
    const deduplicatedCards = filteredCards.reduce((acc, card) => {
      // Verifica se já existe um card com o MESMO ID na lista
      const existingCardIndex = acc.findIndex(c => c.id === card.id);
      
      if (existingCardIndex === -1) {
        // Não existe, adiciona
        acc.push(card);
      } else {
        // Existe (duplicata real), mantém o mais recente
        const existingCard = acc[existingCardIndex];
        const currentCardDate = new Date(card.updated_at);
        const existingCardDate = new Date(existingCard.updated_at);
        
        if (currentCardDate > existingCardDate) {
          // Card atual é mais recente, substitui
          acc[existingCardIndex] = card;
          devLog(`🔄 Duplicata real filtrada: mantendo versão mais recente do card ${card.id}`);
        }
      }
      
      return acc;
    }, [] as PipelineCard[]);

    // Log se houve deduplicação REAL (por ID)
    const removedCount = filteredCards.length - deduplicatedCards.length;
    if (removedCount > 0) {
      devLog(`⚠️ Atenção: ${removedCount} duplicata(s) real(is) removida(s) (mesmo ID)`);
    }

    return deduplicatedCards;
  }, [cards, userRole, selectedPipeline, columns]);

  // Handlers para eventos realtime
  const handleCardInsert = useCallback(async (newCard: PipelineCard) => {
    devLog('✨ [Realtime Handler] Novo card recebido:', newCard);
    
    // Atualizar timestamp de realtime
    if ((window as any).__updateRealtimeTimestamp) {
      (window as any).__updateRealtimeTimestamp();
    }
    
    // Verificar se o card já existe (evitar duplicatas)
    setCards(prev => {
      const exists = prev.some(c => c.id === newCard.id);
      if (exists) {
        devLog('⚠️ [Realtime] Card já existe, ignorando INSERT');
        return prev;
      }
      return prev; // Retornar prev temporariamente enquanto busca dados completos
    });

    // ✅ Incrementar contagem total da coluna
    if (newCard.column_id) {
      setTotalCardsByColumn(prev => ({
        ...prev,
        [newCard.column_id]: (prev[newCard.column_id] || 0) + 1
      }));
    }

    // ✅ BUSCAR DADOS COMPLETOS do card (contact, conversation) se não vierem no realtime
    // O realtime do Supabase não envia relacionamentos por padrão
    const hasFullData = newCard.contact && newCard.conversation;
    
    if (!hasFullData && selectedPipeline?.id && getHeaders) {
      devLog('🔄 [Realtime] Card sem relacionamentos, buscando dados completos...');
      
      try {
        const { data: fullCard, error } = await supabase.functions.invoke(
          `pipeline-management/cards?id=${newCard.id}&lite=1`,
          {
            method: 'GET',
            headers: getHeaders
          }
        );

        if (error) throw error;

        if (fullCard) {
          devLog('✅ [Realtime] Dados completos recebidos:', fullCard);
          
          setCards(prev => {
            const exists = prev.some(c => c.id === fullCard.id);
            if (exists) {
              // Atualizar card existente com dados completos
              return prev.map(c => c.id === fullCard.id ? fullCard : c);
            }
            // Adicionar novo card ao início da lista com dados completos
            return [fullCard, ...prev];
          });
          
          return;
        }
      } catch (error) {
        console.error('❌ [Realtime] Erro ao buscar dados completos do card:', error);
        // Fallback: adicionar card mesmo sem relacionamentos
      }
    }

    // Adicionar card mesmo sem relacionamentos (fallback)
    setCards(prev => {
      const exists = prev.some(c => c.id === newCard.id);
      if (exists) return prev;
      
      devLog('📦 [Realtime] Adicionando card sem relacionamentos (será atualizado no próximo fetch)');
      return [newCard, ...prev];
    });
  }, [selectedPipeline?.id, getHeaders]);

  const handleCardUpdate = useCallback(async (updatedCard: PipelineCard) => {
    devLog('♻️ [Realtime Handler] Card atualizado:', updatedCard);
    
    // Atualizar timestamp de realtime
    if ((window as any).__updateRealtimeTimestamp) {
      (window as any).__updateRealtimeTimestamp();
    }
    
    // Detectar se é um evento de refresh de tags de contato
    const isContactRefresh = (updatedCard as any)._refresh && (updatedCard.id as string).startsWith('refresh-contact-');
    
    if (isContactRefresh) {
      const contactId = (updatedCard.id as string).replace('refresh-contact-', '');
      devLog('🏷️ [Realtime] Refresh de tags para contato:', contactId);
      
      if (!getHeaders) {
        devWarn('⚠️ [Realtime] Headers não disponíveis para refresh');
        return;
      }
      
      // 🔥 Obter snapshot do estado atual para buscar os cards
      setCards((currentCards) => {
        // Identificar cards que precisam refresh
        const cardsToRefresh = currentCards.filter(c => c.contact_id === contactId);
        devLog(`🔄 [Realtime] ${cardsToRefresh.length} card(s) encontrado(s) para refresh`);
        
        if (cardsToRefresh.length === 0) {
          devLog('ℹ️ [Realtime] Nenhum card encontrado para este contato');
          return currentCards;
        }
        
        // Executar fetches em paralelo e atualizar quando completos
        Promise.all(
          cardsToRefresh.map(cardToRefresh =>
            supabase.functions.invoke(
              `pipeline-management/cards?id=${cardToRefresh.id}&lite=1`,
              { method: 'GET', headers: getHeaders }
            )
          )
        ).then((results) => {
          // Processar resultados
          const updatedCards = results
            .map(({ data, error }) => {
              if (error) {
                console.error('❌ [Realtime] Erro ao buscar card:', error);
                return null;
              }
              return data;
            })
            .filter(Boolean) as PipelineCard[];
          
          if (updatedCards.length > 0) {
            devLog(`✅ [Realtime] ${updatedCards.length} card(s) atualizado(s) com novas tags`);
            
            // Atualizar estado com os cards atualizados
            setCards(current => 
              current.map(c => {
                const updated = updatedCards.find(uc => uc.id === c.id);
                return updated || c;
              })
            );
          }
        }).catch((err) => {
          console.error('❌ [Realtime] Erro ao atualizar cards:', err);
        });
        
        // Retornar estado atual imediatamente (updates virão depois)
        return currentCards;
      });
      
      return; // Não processar como update normal
    }
    
    // Se o card atualizado não tem relacionamentos e o card local tinha, preservar
    setCards(prev => {
      devLog('🔄 [Realtime] setCards callback executado');
      devLog('📊 [Realtime] Cards no estado anterior:', prev.length);
      
      const index = prev.findIndex(c => c.id === updatedCard.id);
      devLog('🔍 [Realtime] Índice do card:', index === -1 ? 'NÃO ENCONTRADO' : index);
      
      if (index === -1) {
        devLog('ℹ️ [Realtime] Card não encontrado localmente, buscando dados completos...');
        
        // Buscar dados completos do card ausente
        if (selectedPipeline?.id && getHeaders) {
          (async () => {
            try {
              const { data: fullCard, error } = await supabase.functions.invoke(
                `pipeline-management/cards?id=${updatedCard.id}&lite=1`,
                {
                  method: 'GET',
                  headers: getHeaders
                }
              );

              if (!error && fullCard) {
                devLog('✅ [Realtime] Card completo recebido:', fullCard);
                setCards(p => {
                  const exists = p.some(c => c.id === fullCard.id);
                  if (exists) {
                    // Atualizar card existente preservando relacionamentos
                    const existingIndex = p.findIndex(c => c.id === fullCard.id);
                    const existingCard = p[existingIndex];
                    const mergedCard = {
                      ...fullCard,
                      contact: fullCard.contact || existingCard.contact,
                      conversation: fullCard.conversation || existingCard.conversation,
                    };
                    const newCards = [...p];
                    newCards[existingIndex] = mergedCard;
                    devLog('✅ [Realtime] Card atualizado após busca completa');
                    return newCards;
                  }
                  devLog('✅ [Realtime] Card adicionado após busca completa');
                  return [fullCard, ...p];
                });
              } else {
                // Fallback: adicionar card mesmo sem relacionamentos
                devLog('⚠️ [Realtime] Adicionando card sem relacionamentos (fallback)');
                setCards(p => [updatedCard, ...p]);
              }
            } catch (err) {
              console.error('❌ [Realtime] Erro ao buscar card completo:', err);
              setCards(p => [updatedCard, ...p]);
            }
          })();
        }
        
        return prev; // Retornar prev enquanto busca
      }
      
      // ✅ PRESERVAR relacionamentos existentes se o update não trouxer
      const existingCard = prev[index];
      devLog('📋 [Realtime] Card existente encontrado:', {
        id: existingCard.id,
        column_id: existingCard.column_id,
        title: existingCard.title
      });
      
      // ✅ DETECTAR MUDANÇA DE COLUNA para logs claros
      const columnChanged = existingCard.column_id !== updatedCard.column_id;
      if (columnChanged) {
        devLog('🔄 [Realtime] ⚠️⚠️⚠️ MUDANÇA DE COLUNA DETECTADA ⚠️⚠️⚠️:', {
          cardId: updatedCard.id,
          cardTitle: updatedCard.title || existingCard.title,
          fromColumn: existingCard.column_id,
          toColumn: updatedCard.column_id,
          timestamp: new Date().toISOString()
        });
        
        // ✅ Atualizar contagem total: decrementar coluna antiga, incrementar nova
        setTotalCardsByColumn(counts => ({
          ...counts,
          [existingCard.column_id]: Math.max(0, (counts[existingCard.column_id] || 0) - 1),
          [updatedCard.column_id]: (counts[updatedCard.column_id] || 0) + 1
        }));
        
        // 🔥 CANCELAR TIMEOUT PENDENTE - evento realtime chegou!
        const pendingTimeout = pendingTimeoutsRef.current.get(updatedCard.id);
        if (pendingTimeout) {
          devLog('✅ [Realtime] Cancelando timeout pendente - evento chegou a tempo!');
          clearTimeout(pendingTimeout);
          pendingTimeoutsRef.current.delete(updatedCard.id);
        }
      } else {
        devLog('ℹ️ [Realtime] Update detectado (mesma coluna)');
      }
      
      // ✅ Evitar refetch em todo UPDATE (isso cria "pisca" e muita rede).
      // Se algum campo realmente precisar (ex.: tags), ele será atualizado por fetch sob demanda (abrir card)
      // ou pelos eventos específicos (ex.: refresh-contact-...).
      
      const mergedCard = {
        ...updatedCard,
        // Preservar contact se não vier no update
        contact: updatedCard.contact || existingCard.contact,
        // Preservar conversation se não vier no update
        conversation: updatedCard.conversation || existingCard.conversation,
      };
      
      // ✅ SEMPRE APLICAR ATUALIZAÇÃO REALTIME (fonte autoritativa do servidor)
      devLog('🔄 [Realtime] Aplicando atualização do servidor', {
        cardId: mergedCard.id,
        columnChanged,
        newColumnId: mergedCard.column_id,
        oldColumnId: existingCard.column_id
      });
      
      const newCards = [...prev];
      newCards[index] = mergedCard;
      
      devLog('✅ [Realtime] Novo estado criado:', {
        totalCards: newCards.length,
        cardAtualizado: newCards[index].column_id,
        cardAnterior: existingCard.column_id
      });
      
      return newCards;
    });
  }, [selectedPipeline?.id, getHeaders]);

  const handleCardDelete = useCallback((cardId: string) => {
    devLog('🗑️ [Realtime Handler] Card deletado:', cardId);
    
    // Decrementar contagem da coluna do card antes de remover
    setCards(prev => {
      const cardToDelete = prev.find(c => c.id === cardId);
      if (cardToDelete?.column_id) {
        setTotalCardsByColumn(counts => ({
          ...counts,
          [cardToDelete.column_id]: Math.max(0, (counts[cardToDelete.column_id] || 0) - 1)
        }));
      }
      return prev.filter(c => c.id !== cardId);
    });
  }, []);

  const handleColumnInsert = useCallback((newColumn: PipelineColumn) => {
    devLog('✨ [Realtime Handler] Nova coluna recebida:', newColumn);
    
    setColumns(prev => {
      const exists = prev.some(c => c.id === newColumn.id);
      if (exists) return prev;
      
      return [...prev, newColumn].sort((a, b) => a.order_position - b.order_position);
    });
  }, []);

  const handleColumnUpdate = useCallback((updatedColumn: PipelineColumn) => {
    devLog('♻️ [Realtime Handler] Coluna atualizada:', updatedColumn);
    
    // Atualizar timestamp de realtime
    if ((window as any).__updateRealtimeTimestamp) {
      (window as any).__updateRealtimeTimestamp();
    }
    
    setColumns(prev => 
      prev.map(col => 
        col.id === updatedColumn.id ? { ...col, ...updatedColumn } : col
      ).sort((a, b) => a.order_position - b.order_position)
    );
  }, []);

  const handleColumnDelete = useCallback((columnId: string) => {
    devLog('🗑️ [Realtime Handler] Coluna deletada:', columnId);
    
    setColumns(prev => prev.filter(c => c.id !== columnId));
    
    // Remover cards da coluna deletada
    setCards(prev => prev.filter(c => c.column_id !== columnId));
  }, []);

  // 🤖 Handler para atualização de conversation via realtime
  const handleConversationUpdate = useCallback((conversationId: string, updates: any) => {
    devLog('🤖 [Context] Atualizando conversation via realtime:', { conversationId, updates });
    
    setCards(current => 
      current.map(card => {
        if (card.conversation_id === conversationId) {
          return {
            ...card,
            conversation: {
              ...(card.conversation || { id: conversationId } as any),
              ...updates
            }
          };
        }
        return card;
      })
    );
  }, []);

  // Ativar realtime quando um pipeline é selecionado
  usePipelineRealtime({
    pipelineId: selectedPipeline?.id || null,
    onCardInsert: handleCardInsert,
    onCardUpdate: handleCardUpdate,
    onCardDelete: handleCardDelete,
    onColumnInsert: handleColumnInsert,
    onColumnUpdate: handleColumnUpdate,
    onColumnDelete: handleColumnDelete,
    onConversationUpdate: handleConversationUpdate,
  });

  // Função reorderColumns como useCallback para evitar problemas com dependências
  const reorderColumns = useCallback(async (newColumns: PipelineColumn[]) => {
    try {
      devLog('🔄 Reordenando colunas otimisticamente');
      
      // ✅ Atualizar estado local IMEDIATAMENTE para UX fluida
      setColumns(newColumns);
      
      // Atualizar no backend em paralelo (não bloqueia UI)
      const updates = newColumns.map((col, index) => ({
        id: col.id,
        order_position: index
      }));

      if (!getHeaders) {
        throw new Error('Headers not available');
      }

      // 🚀 Fazer todas as requisições em PARALELO ao invés de sequencial
      await Promise.all(
        updates.map(update =>
          supabase.functions.invoke(`pipeline-management/columns?id=${update.id}`, {
            method: 'PUT',
            headers: getHeaders,
            body: {
              order_position: update.order_position
            }
          })
        )
      );

      // ✅ Não fazer re-fetch - deixar o realtime sincronizar naturalmente
      devLog('✅ Colunas reordenadas no backend');
      
      // ✅ SEM TOAST - ação é instantânea e não precisa de feedback
    } catch (error) {
      console.error('❌ Erro ao reordenar colunas:', error);
      
      // Só mostrar toast em caso de ERRO
      toast({
        title: "Erro ao reordenar", 
        description: "Não foi possível salvar a nova ordem",
        variant: "destructive",
      });
      
      // Reverter para o estado anterior em caso de erro
      if (selectedPipeline?.id) {
        await fetchColumns(selectedPipeline.id);
      }
    }
  }, [getHeaders, selectedPipeline, fetchColumns, toast]);

  // ✅ (DEV-only) Debug removido do runtime para não degradar performance em pipelines com muitos cards.

  // 🚀 Manter refs atualizados a cada render (executados antes dos effects)
  fetchColumnsRef.current = fetchColumns;
  fetchCardsRef.current = fetchCards;
  fetchPipelinesRef.current = fetchPipelines;
  fetchBoardDataRef.current = fetchBoardData;
  cardsRef.current = cards;

  // Buscar pipelines quando o workspace mudar
  // 🚀 Usa refs + guard de workspace para NUNCA re-inicializar desnecessariamente
  useEffect(() => {
    const wsId = selectedWorkspace?.workspace_id;

    devLog('🔍 [PipelinesContext] useEffect triggered:', {
      hasWorkspace: !!wsId,
      hasHeaders: !!getHeaders,
      workspaceId: wsId,
      lastInitialized: lastInitializedWorkspaceRef.current
    });
    
    if (wsId && getHeaders) {
      // 🚀 Guard: se já inicializamos para este workspace, não refazer
      if (lastInitializedWorkspaceRef.current === wsId) {
        devLog('🚀 [PipelinesContext] Workspace já inicializado, ignorando re-fetch');
        return;
      }
      
      devLog('✅ [PipelinesContext] Conditions met, fetching pipelines...');
      lastInitializedWorkspaceRef.current = wsId;
      
      // 🚀 Loading unificado: um único spinner até tudo estar pronto
      setIsInitializingBoard(true);
      setColumns([]);
      setCards([]);
      setSelectedPipeline(null);
      
      // Buscar novos pipelines e forçar seleção do primeiro
      fetchPipelinesRef.current(true);
    } else {
      devLog('⚠️ [PipelinesContext] Conditions not met, clearing pipelines');
      lastInitializedWorkspaceRef.current = null;
      setPipelines([]);
      setSelectedPipeline(null);
      setColumns([]);
      setCards([]);
      setIsInitializingBoard(false);
    }
  }, [selectedWorkspace?.workspace_id, getHeaders]);

  // 🚀🚀🚀 CARREGAMENTO UNIFICADO DO BOARD: 1 única chamada HTTP
  // Substitui: fetchColumns → fetchCards (N+1 calls) → fetchTotalCardsCounts
  // Agora: fetchBoardData (1 call) retorna colunas + cards + contagens via RPC
  useEffect(() => {
    if (selectedPipeline?.id) {
      let cancelled = false;
      const pipelineId = selectedPipeline.id;

      (async () => {
        try {
          await fetchBoardDataRef.current(pipelineId);
        } catch (err) {
          console.error('❌ [PipelinesContext] Erro ao inicializar board:', err);
        } finally {
          if (!cancelled) {
            setIsInitializingBoard(false);
          }
        }
      })();

      return () => { cancelled = true; };
    } else {
      setColumns([]);
      setCards([]);
      setCardsOffsetByColumn({});
      setHasMoreCardsByColumn({});
      setIsLoadingMoreCardsByColumn({});
    }
  }, [selectedPipeline?.id]);

  // ✅ REFETCH INTELIGENTE: Garantir que cards apareçam mesmo se realtime falhar
  // 🚀 Usa cardsRef para evitar recriar o interval a cada mudança de cards
  useEffect(() => {
    if (!selectedPipeline?.id) return;

    let lastFetchTime = Date.now();
    let lastRealtimeUpdate = Date.now();
    let consecutiveEmptyFetches = 0;

    const updateRealtimeTimestamp = () => {
      lastRealtimeUpdate = Date.now();
    };

    (window as any).__updateRealtimeTimestamp = updateRealtimeTimestamp;

    const interval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchTime;
      const timeSinceLastRealtime = now - lastRealtimeUpdate;
      const currentCards = cardsRef.current;
      
      const hasIncompleteCards = currentCards.some(c => 
        (c.contact_id && !c.contact) || 
        (c.conversation_id && !c.conversation)
      );
      
      if (hasIncompleteCards) {
        devLog('🔄 [Refetch] Cards incompletos detectados');
        return;
      }
      
      if (
        timeSinceLastRealtime > 60000 && 
        timeSinceLastFetch > 30000 && 
        currentCards.length === 0 && 
        consecutiveEmptyFetches < 3
      ) {
        devLog('🔄 [Refetch] Sem atualizações realtime há muito tempo, verificando...');
        refreshCurrentPipeline();
        lastFetchTime = now;
        consecutiveEmptyFetches++;
        return;
      }
      
      if (currentCards.length > 0) {
        consecutiveEmptyFetches = 0;
      }
    }, 15000);

    return () => {
      clearInterval(interval);
      delete (window as any).__updateRealtimeTimestamp;
    };
  }, [selectedPipeline?.id, refreshCurrentPipeline]);

  // Função para atualizar otimisticamente o status do agente de uma conversa
  const updateConversationAgentStatus = useCallback((
    conversationId: string, 
    agente_ativo: boolean, 
    agent_active_id?: string | null
  ) => {
    devLog('🤖 [Context] Update otimista agente:', { conversationId, agente_ativo, agent_active_id });
    
    setCards(current => 
      current.map(card => {
        if (card.conversation_id === conversationId && card.conversation) {
          return {
            ...card,
            conversation: {
              ...card.conversation,
              agente_ativo,
              agent_active_id: agent_active_id !== undefined ? agent_active_id : card.conversation.agent_active_id
            }
          };
        }
        return card;
      })
    );
  }, []);

  const value = useMemo(() => ({
    pipelines,
    selectedPipeline,
    columns,
    cards,
    isLoading,
    isLoadingColumns,
    isLoadingCards,
    isInitializingBoard,
    isLoadingInitialCardsByColumn,
    isAllColumnsLoaded,
    hasMoreCardsByColumn,
    isLoadingMoreCardsByColumn,
    totalCardsByColumn,
    fetchPipelines,
    createPipeline,
    deletePipeline,
    selectPipeline,
    refreshCurrentPipeline,
    createColumn,
    createCard,
    updateCard,
    moveCard,
    moveCardOptimistic,
    fetchMoreCards,
    getCardsByColumn,
    reorderColumns,
    updateConversationAgentStatus,
  }), [
    pipelines,
    selectedPipeline,
    columns,
    cards,
    isLoading,
    isLoadingColumns,
    isLoadingCards,
    isInitializingBoard,
    isLoadingInitialCardsByColumn,
    isAllColumnsLoaded,
    hasMoreCardsByColumn,
    isLoadingMoreCardsByColumn,
    totalCardsByColumn,
    fetchPipelines,
    createPipeline,
    deletePipeline,
    selectPipeline,
    refreshCurrentPipeline,
    createColumn,
    createCard,
    updateCard,
    moveCard,
    moveCardOptimistic,
    fetchMoreCards,
    getCardsByColumn,
    reorderColumns,
    updateConversationAgentStatus,
  ]);

  return (
    <PipelinesContext.Provider value={value}>
      {children}
    </PipelinesContext.Provider>
  );
}

export function usePipelinesContext() {
  const context = useContext(PipelinesContext);
  if (context === undefined) {
    throw new Error('usePipelinesContext must be used within a PipelinesProvider');
  }
  return context;
}