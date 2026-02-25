// @ts-nocheck
import { useEffect, useMemo, useState, useContext, useRef } from 'react';
import { useTheme } from 'next-themes';
import { Workspace, useWorkspace } from '@/contexts/WorkspaceContext';
import { usePipelinesContext, PipelinesContext } from '@/contexts/PipelinesContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, Tooltip as ReTooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Filter, Users, Download, Loader2, Check, X, Plus, Trash2, Pencil, GripVertical, Save } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QueryBuilderSidebar } from './QueryBuilderSidebar';
import { useReportIndicatorFunnelPresets } from '@/hooks/useReportIndicatorFunnelPresets';
import { useReportUserSettings } from '@/hooks/useReportUserSettings';
import { useReportFilterPresets } from '@/hooks/useReportFilterPresets';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

type PeriodPreset = 'all' | 'today' | 'last7' | 'last30' | 'custom';

interface RelatoriosAvancadosProps {
  workspaces?: Workspace[];
}

interface ContactRecord {
  id: string;
  created_at: string;
  responsible_id?: string | null;
  status?: string | null;
}

interface ActivityRecord {
  id: string;
  contact_id?: string | null;
  responsible_id?: string | null;
  type?: string | null;
  created_at: string;
  status?: string | null;
}

type TeamWorkRankingRow = {
  responsible_id: string | null;
  mensagem: number | null;
  ligacao_nao_atendida: number | null;
  ligacao_atendida: number | null;
  ligacao_abordada: number | null;
  ligacao_agendada: number | null;
  ligacao_follow_up: number | null;
  reuniao_agendada: number | null;
  reuniao_realizada: number | null;
  reuniao_nao_realizada: number | null;
  reuniao_reagendada: number | null;
  whatsapp_enviado: number | null;
  proposta_enviada: number | null;
  venda_realizada: number | null;
};

interface PipelineCardRecord {
  id: string;
  contact_id?: string | null;
  value?: number | null;
  status?: string | null;
  pipeline_id?: string | null;
  column_id?: string | null;
  responsible_user_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  closed_at?: string | null;
  won_at?: string | null;
  qualification?: string | null;
  products?: {
    product_id: string | null;
    product_name_snapshot?: string | null;
    quantity?: number | null;
    unit_value?: number | null;
    total_value?: number | null;
    product?: { id?: string | null; name?: string | null; value?: number | null } | null;
  }[];
}

interface TagRecord {
  contact_id: string;
  tag_id: string;
  tag?: { name?: string | null };
}

// Histórico de movimentação de cards entre colunas
interface CardColumnHistoryRecord {
  card_id: string;
  old_column_id: string | null;
  new_column_id: string | null;
  changed_at: string;
}

const pieColors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#14B8A6', '#6366F1'];

interface CustomConversion {
  id: string;
  name: string;
  pipelineA: string;
  columnA: string;
  pipelineB: string;
  columnB: string;
  isEditing?: boolean;
}

type TeamMetricKey = 'leads' | `activity:${string}`;

interface TeamConversion {
  id: string;
  name: string;
  metricA: TeamMetricKey;
  metricB: TeamMetricKey;
  isEditing?: boolean;
}

function SortableCard({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled?: boolean;
  children: any;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !!disabled,
  });

  const style: any = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {!disabled && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          className={cn(
            "absolute top-1 left-1 z-20 h-5 w-5 flex items-center justify-center rounded-none",
            "cursor-grab active:cursor-grabbing",
            "bg-white/70 dark:bg-[#1b1b1b]/70 backdrop-blur-sm",
            "text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-200",
            "opacity-0 group-hover:opacity-100 transition-opacity"
          )}
          title="Arraste para reordenar"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3 w-3" />
        </button>
      )}
      {children}
    </div>
  );
}

export function RelatoriosAvancados({ workspaces = [] }: RelatoriosAvancadosProps) {
  const { theme, resolvedTheme } = useTheme();
  // `theme` pode ser "system"; `resolvedTheme` nem sempre vem preenchido dependendo do setup.
  // Em runtime, a fonte mais confiável é a classe `dark` no <html>.
  const isDark =
    (typeof document !== 'undefined' && document.documentElement.classList.contains('dark')) ||
    (resolvedTheme ?? theme) === 'dark';
  const { selectedWorkspace, setSelectedWorkspace, workspaces: ctxWorkspaces } = useWorkspace();
  const { user, userRole } = useAuth();
  
  
  // Tentar usar o contexto de pipelines, mas não falhar se não estiver disponível (master-dashboard)
  const pipelinesContext = useContext(PipelinesContext);
  const ctxPipelines = pipelinesContext?.pipelines || [];
  const fetchCtxPipelines = pipelinesContext?.fetchPipelines;
  
  const { getHeaders } = useWorkspaceHeaders();
  const allowReorder = true;

  const [customConversions, setCustomConversions] = useState<CustomConversion[]>([]);
  const [pipelineColumnsMap, setPipelineColumnsMap] = useState<Record<string, { id: string, name: string }[]>>({});
  const [loadingColumnsMap, setLoadingColumnsMap] = useState<Record<string, boolean>>({});
  const [teamConversions, setTeamConversions] = useState<TeamConversion[]>([]);

  // ✅ Filtro fixo: últimos 30 dias (sem persistência para evitar oscilação)
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('last30');
  const [startDate, setStartDate] = useState<Date | null>(() => startOfDay(subDays(new Date(), 29)));
  const [endDate, setEndDate] = useState<Date | null>(() => endOfDay(new Date()));
  // Se workspaces for fornecido (master-dashboard), por padrão mostra todos os workspaces (vazio)
  // Caso contrário, usa o workspace selecionado ou o primeiro disponível
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(() => {
    if (workspaces && workspaces.length > 0) {
      // Master-dashboard: por padrão mostra todos os workspaces (string vazia)
      return '';
    }
    // Modo normal: usar workspace do contexto ou primeiro disponível
    return selectedWorkspace?.workspace_id || ctxWorkspaces?.[0]?.workspace_id || '';
  });
  
  // Workspace efetivo usado para carregar presets/configs e metadados (pipelines/tags/etc).
  // Importante: no modo master, `selectedWorkspaceId === ''` significa "todas as empresas",
  // mas ainda precisamos de um workspace de referência para presets/metadata.
  const settingsWorkspaceId = useMemo(() => {
    return (
      selectedWorkspaceId ||
      selectedWorkspace?.workspace_id ||
      workspaces?.[0]?.workspace_id ||
      ctxWorkspaces?.[0]?.workspace_id ||
      ''
    );
  }, [
    selectedWorkspaceId,
    selectedWorkspace?.workspace_id,
    workspaces?.length,
    workspaces?.[0]?.workspace_id,
    ctxWorkspaces?.length,
    ctxWorkspaces?.[0]?.workspace_id,
  ]);
  const [selectedFunnel, setSelectedFunnel] = useState<string>('all');
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [pipelines, setPipelines] = useState<{ id: string; name: string }[]>([]);
  const [availableTags, setAvailableTags] = useState<{ id: string; name: string }[]>([]);
  const [availableProducts, setAvailableProducts] = useState<{ id: string; name: string }[]>([]);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [activities, setActivities] = useState<ActivityRecord[]>([]);
  const [cards, setCards] = useState<PipelineCardRecord[]>([]);
  const [tags, setTags] = useState<TagRecord[]>([]);
  const [cardColumnHistory, setCardColumnHistory] = useState<CardColumnHistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'bi' | 'kpis' | 'funnel'>('funnel');
  // Preset/draft: Funis (múltiplos) do bloco "Funil – Indicadores"
  const { savedFunnels, canEdit: canEditIndicatorFunnels, loading: loadingFunnelsPreset } =
    useReportIndicatorFunnelPresets(settingsWorkspaceId);
  const { settings: userSettings, saveSettings: saveUserSettings, loading: loadingUserSettings } =
    useReportUserSettings(settingsWorkspaceId);
  
  // Filtros de relatório salvos para a empresa (master/admin salvam, todos veem)
  const { 
    savedFilters: companyFilters, 
    canEdit: canEditCompanyFilters, 
    savePresets: saveCompanyFilters,
    loading: loadingCompanyFilters 
  } = useReportFilterPresets(settingsWorkspaceId);
  // ^ no modo "todas as empresas", este preset é carregado do workspace de referência
  // para não travar a tela. (Dados multi-empresa são agregados via fetchData.)
  const [draftFunnels, setDraftFunnels] = useState<any[]>([]);
  // Mantém sempre a versão mais recente dos filtros para evitar salvar estado "antigo"
  // quando o usuário clica em Salvar logo após mudar um filtro.
  const draftFunnelsRef = useRef<any[]>([]);
  useEffect(() => {
    draftFunnelsRef.current = draftFunnels;
  }, [draftFunnels]);
  const [editingMetricsFunnelId, setEditingMetricsFunnelId] = useState<string | null>(null);
  const [rehydrateNonce, setRehydrateNonce] = useState(0);
  const lastFetchKeyRef = useRef<string | null>(null);
  const fetchDebounceRef = useRef<number | null>(null);
  const activeFetchIdRef = useRef<string | null>(null);
  const applyPreset = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    switch (preset) {
      case 'all':
        setStartDate(null);
        setEndDate(null);
        break;
      case 'today':
        setStartDate(startOfDay(new Date()));
        setEndDate(endOfDay(new Date()));
        break;
      case 'last7':
        setStartDate(startOfDay(subDays(new Date(), 6)));
        setEndDate(endOfDay(new Date()));
        break;
      case 'last30':
        setStartDate(startOfDay(subDays(new Date(), 29)));
        setEndDate(endOfDay(new Date()));
        break;
      case 'custom':
      default:
        break;
    }
  };

  const fetchAgents = async (workspaceId?: string | null) => {
    // Sempre filtra pelo workspace atual para respeitar o escopo
    if (!workspaceId) {
      setAgents([]);
      return;
    }
    const { data, error } = await supabase
      .from('workspace_members')
      .select('user_id, role, system_users(id, name, profile)')
      .eq('workspace_id', workspaceId);
    if (error) {
      console.error('Erro ao buscar usuários do workspace:', error);
      setAgents([]);
      return;
    }
    const agentsList = (data || [])
      .filter((wm: any) => {
        // NUNCA incluir usuários masters ou support (seja no role do workspace ou no perfil global)
        const isMasterRole = wm.role === 'master' || wm.role === 'support';
        const isMasterProfile = wm.system_users?.profile === 'master' || wm.system_users?.profile === 'support';
        return !isMasterRole && !isMasterProfile;
      })
      .map((wm: any) => wm.system_users)
      .filter(Boolean)
      .map((su: any) => ({ id: su.id, name: su.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    setAgents(agentsList);
  };

  const fetchPipelines = async (workspaceId: string | null) => {
    if (!workspaceId) {
      setPipelines([]);
      return;
    }
    const { data, error } = await supabase.from('pipelines').select('id, name').eq('workspace_id', workspaceId).order('name');
    if (error) {
      console.error('Erro ao buscar pipelines:', error);
      setPipelines([]);
      return;
    }
    setPipelines(data || []);
  };

  const fetchTags = async (workspaceId: string | null) => {
    if (!workspaceId) {
      setAvailableTags([]);
      return;
    }
    try {
      // 1. Busca todas as tags do workspace
      const { data: tagsData, error: tagsError } = await supabase
        .from('tags')
        .select('id, name')
        .eq('workspace_id', workspaceId)
        .order('name');
      
      if (tagsError) throw tagsError;

      // Se não houver tags, não rodar query pesada de associações.
      if (!tagsData || tagsData.length === 0) {
        setAvailableTags([]);
        return;
      }

      // 2. Busca associações SOMENTE das tags deste workspace (evita scan global da tabela)
      const tagIds = tagsData.map((t: any) => t.id).filter(Boolean);
      const { data: ctData, error: ctError } = await supabase
        .from('contact_tags')
        .select('tag_id, contact_id')
        .in('tag_id', tagIds);
      
      if (ctError) throw ctError;

      // 3. Processa contagem
      const countsMap = new Map<string, Set<string>>();
      (ctData || []).forEach(ct => {
        if (!countsMap.has(ct.tag_id)) countsMap.set(ct.tag_id, new Set());
        countsMap.get(ct.tag_id)?.add(ct.contact_id);
      });

      const processed = (tagsData || []).map(t => ({
        ...t,
        contact_count: countsMap.get(t.id)?.size || 0
      }));

      setAvailableTags(processed);
    } catch (err) {
      console.error('Erro ao buscar tags com contagem real:', err);
      setAvailableTags([]);
    }
  };

  const fetchProducts = async (workspaceId: string | null) => {
    if (!workspaceId) {
      setAvailableProducts([]);
      return;
    }
    try {
      // 1. Busca todos os produtos do workspace
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name')
        .eq('workspace_id', workspaceId)
        .order('name');
      
      if (productsError) throw productsError;

      if (!productsData || productsData.length === 0) {
        setAvailableProducts([]);
        return;
      }

      // 2. Busca contagem de associações para estes produtos
      const productIds = productsData.map(p => p.id);
      const { data: pcpData, error: pcpError } = await supabase
        .from('pipeline_cards_products')
        .select('product_id, pipeline_card_id')
        .in('product_id', productIds);
      
      if (pcpError) throw pcpError;

      // 3. Processa contagem de cards únicos por produto
      // (Aproximação: cada card geralmente é um contato no funil)
      const countsMap = new Map<string, Set<string>>();
      (pcpData || []).forEach(pcp => {
        if (pcp.product_id && pcp.pipeline_card_id) {
          if (!countsMap.has(pcp.product_id)) countsMap.set(pcp.product_id, new Set());
          countsMap.get(pcp.product_id)?.add(pcp.pipeline_card_id);
        }
      });

      const processed = productsData.map(p => ({
        ...p,
        contact_count: countsMap.get(p.id)?.size || 0
      }));

      setAvailableProducts(processed);
    } catch (err) {
      console.error('Erro ao buscar produtos:', err);
      setAvailableProducts([]);
    }
  };

  function normalizeFunnelGroups(funnelFilters: any): any[] {
    if (!Array.isArray(funnelFilters)) return [];
    // Novo formato: array de grupos
    if (funnelFilters[0]?.pipeline !== undefined) {
      return funnelFilters.map((g: any) => ({
        pipeline: g.pipeline ?? 'all',
        column: g.column ?? 'all',
        team: g.team ?? 'all',
        tags: Array.isArray(g.tags) ? g.tags.filter(Boolean) : [],
        products: Array.isArray(g.products) ? g.products.filter(Boolean) : [],
        dateRange: g.dateRange
          ? {
              // Normaliza para início/fim do dia local para evitar “pular um dia” por timezone ao persistir/rehidratar
              from: g.dateRange.from ? startOfDay(new Date(g.dateRange.from)) : undefined,
              to: g.dateRange.to ? endOfDay(new Date(g.dateRange.to)) : undefined,
            }
          : {},
        status: g.status ?? 'all',
        value: g.value ? { value: g.value.value, operator: g.value.operator } : null,
      }));
    }
    // Legado: FilterItem[]
    const byType = new Map<string, any[]>();
    funnelFilters.forEach((f) => {
      const arr = byType.get(f.type) || [];
      arr.push(f);
      byType.set(f.type, arr);
    });
    const pipeline = byType.get('pipeline')?.[0]?.value || 'all';
    const column = byType.get('column')?.[0]?.value || 'all';
    const team = byType.get('team')?.[0]?.value || 'all';
    const status = byType.get('status')?.[0]?.value || 'all';
    const tagsArr = (byType.get('tags') || []).map((t) => t.value).filter(Boolean);
    const productsArr = (byType.get('products') || []).map((t) => t.value).filter(Boolean);
    const valueItem = byType.get('value')?.[0];
    const date = byType.get('date')?.[0];
    let parsedRange: { from?: Date; to?: Date } = {};
    if (date?.value && date.operator === 'between') {
      const [from, to] = String(date.value).split('|');
      const dFrom = from ? new Date(from) : null;
      const dTo = to ? new Date(to) : null;
      if (dFrom && !Number.isNaN(dFrom.getTime()) && dTo && !Number.isNaN(dTo.getTime())) {
        parsedRange = { from: startOfDay(dFrom), to: endOfDay(dTo) };
      }
    }
    return [{
      pipeline,
      column,
      team,
      tags: tagsArr,
      products: productsArr,
      dateRange: parsedRange,
      status,
      value: valueItem ? { value: valueItem.value, operator: valueItem.operator } : null,
    }];
  }

  const sanitizeGroupsForPersist = (groups: any[]) =>
    (groups || []).map((g) => ({
      pipeline: g.pipeline ?? 'all',
      column: g.column ?? 'all',
      team: g.team ?? 'all',
      tags: Array.isArray(g.tags) ? g.tags.filter(Boolean) : [],
      products: Array.isArray(g.products) ? g.products.filter(Boolean) : [],
      dateRange: g.dateRange
        ? {
            // Persistir datas sempre normalizadas (início/fim do dia local) evita loop de “um dia pra outro”
            from: g.dateRange.from ? startOfDay(new Date(g.dateRange.from)).toISOString() : undefined,
            to: g.dateRange.to ? endOfDay(new Date(g.dateRange.to)).toISOString() : undefined,
          }
        : {},
      status: g.status ?? 'all',
      value: g.value ? { value: g.value.value ?? '', operator: g.value.operator } : null,
    }));

  const serializeGroups = (groups: any[]) => JSON.stringify(groups || []);

  const buildFunnelsForDb = (funnels: any[]) =>
    (funnels || []).map((f: any, idx: number) => ({
      id: String(f.id || `funnel-${idx + 1}`),
      name: String(f.name || `Funil ${idx + 1}`),
      filters: sanitizeGroupsForPersist(Array.isArray(f.filters) ? f.filters : []),
      lead_metrics: (Array.isArray(f.lead_metrics) ? f.lead_metrics : [])
        .map((m: any, mi: number) => ({
          id: String(m?.id || `metric-${mi + 1}`),
          title: String(m?.title || m?.name || 'Métrica'),
          pipeline: String(m?.pipeline || 'all'),
          column: String(m?.column || 'all'),
        }))
        .filter((m: any) => m.id && m.title),
    }));

  const persistUserReportSettings = async (next?: {
    funnels?: any[];
    customConversions?: CustomConversion[];
    teamConversions?: TeamConversion[];
    customConversionsFilter?: any;
    teamConversionsFilter?: any;
  }) => {
    const funnelsToSave = buildFunnelsForDb(next?.funnels ?? draftFunnelsRef.current ?? draftFunnels);
    const conversionsToSave = (next?.customConversions ?? customConversions).map((c) => ({ ...c, isEditing: false }));
    const teamToSave = (next?.teamConversions ?? teamConversions).map((c) => ({ ...c, isEditing: false }));

    // ✅ Evita salvar globalFilter "nulo" antes de hidratar e causar oscilação no próximo load
    const savedGf = (userSettings as any)?.globalFilter;
    const gfPreset: any = periodPreset ?? savedGf?.preset ?? 'last30';
    const gfDerived = applyPresetToRange(gfPreset);
    const gfStartIso =
      startDate ? startDate.toISOString() : (savedGf?.startDate ?? (gfDerived.from ? gfDerived.from.toISOString() : null));
    const gfEndIso =
      endDate ? endDate.toISOString() : (savedGf?.endDate ?? (gfDerived.to ? gfDerived.to.toISOString() : null));

    await saveUserSettings({
      funnels: funnelsToSave,
      customConversions: conversionsToSave,
      teamConversions: teamToSave,
      globalFilter: {
        preset: gfPreset,
        startDate: gfStartIso,
        endDate: gfEndIso,
        agent: selectedAgent,
        funnel: selectedFunnel,
        tags: selectedTags,
      },
      customConversionsFilter:
        next?.customConversionsFilter ?? {
          preset: customConvPeriodPreset,
          startDate: customConvStartDate ? customConvStartDate.toISOString() : null,
          endDate: customConvEndDate ? customConvEndDate.toISOString() : null,
          agent: customConvAgent,
          tags: customConvTags,
          status: customConvStatus,
        },
      teamConversionsFilter:
        next?.teamConversionsFilter ?? {
          preset: teamConvPeriodPreset,
          startDate: teamConvStartDate ? teamConvStartDate.toISOString() : null,
          endDate: teamConvEndDate ? teamConvEndDate.toISOString() : null,
          agent: teamConvAgent,
          tags: teamConvTags,
          status: teamConvStatus,
        },
    });
  };

  // Salva filtros atuais como padrão da empresa (apenas admin/master)
  const saveCompanyFiltersPreset = async () => {
    if (!canEditCompanyFilters) return;
    
    const filtersToSave = {
      customConv: {
        periodPreset: customConvPeriodPreset,
        agent: customConvAgent,
        tags: customConvTags,
        status: customConvStatus,
      },
      teamConv: {
        periodPreset: teamConvPeriodPreset,
        agent: teamConvAgent,
        tags: teamConvTags,
        status: teamConvStatus,
      },
      salesRanking: {
        periodPreset: salesRankingPreset,
        visibleUsers: salesRankingUsers,
      },
      workRanking: {
        periodPreset: workRankingPreset,
        visibleUsers: workRankingUsers,
      },
      funnels: buildFunnelsForDb(draftFunnelsRef.current ?? draftFunnels),
      // Conversões customizadas para toda a empresa
      customConversions: customConversions.map(c => ({ ...c, isEditing: false })),
      teamConversions: teamConversions.map(c => ({ ...c, isEditing: false })),
    };
    
    await saveCompanyFilters(filtersToSave);
  };

  const addCustomConversion = () => {
    const newConv: CustomConversion = {
      id: crypto.randomUUID(),
      name: '',
      pipelineA: 'all',
      columnA: 'all',
      pipelineB: 'all',
      columnB: 'all',
      isEditing: true,
    };
    setCustomConversions(prev => [...prev, newConv]);
  };

  const addTeamConversion = () => {
    const newConv: TeamConversion = {
      id: crypto.randomUUID(),
      name: '',
      metricA: 'leads',
      metricB: 'leads',
      isEditing: true,
    };
    setTeamConversions((prev) => [...prev, newConv]);
  };

  // Salva conversões customizadas da empresa (admin/master)
  const saveCompanyConversions = async (updates: { customConversions?: any[]; teamConversions?: any[] }) => {
    if (!canEditCompanyFilters) return;
    const filtersToSave = {
      ...companyFilters,
      ...(updates.customConversions !== undefined && { customConversions: updates.customConversions.map(c => ({ ...c, isEditing: false })) }),
      ...(updates.teamConversions !== undefined && { teamConversions: updates.teamConversions.map(c => ({ ...c, isEditing: false })) }),
    };
    await saveCompanyFilters(filtersToSave);
  };

  const removeCustomConversion = (id: string) => {
    const next = customConversions.filter(c => c.id !== id);
    setCustomConversions(next);
    saveCompanyConversions({ customConversions: next });
  };

  const removeTeamConversion = (id: string) => {
    const next = teamConversions.filter((c) => c.id !== id);
    setTeamConversions(next);
    saveCompanyConversions({ teamConversions: next });
  };

  const addLeadMetric = (funnelId: string) => {
    const id = crypto.randomUUID();
    const defaultPipelineId = pipelines?.[0]?.id || 'all';
    if (defaultPipelineId !== 'all') {
      fetchColumnsForPipeline(defaultPipelineId);
    }
    setDraftFunnels((prev: any[]) =>
      prev.map((f) =>
        f.id === funnelId
          ? {
              ...f,
              lead_metrics: [
                ...(Array.isArray(f.lead_metrics) ? f.lead_metrics : []),
                {
                  id,
                  title: '',
                  pipeline: defaultPipelineId,
                  column: 'all',
                  isEditing: true,
                },
              ],
            }
          : f
      )
    );
  };

  const patchLeadMetric = (funnelId: string, metricId: string, patch: any) => {
    setDraftFunnels((prev: any[]) =>
      prev.map((f) => {
        if (f.id !== funnelId) return f;
        const metrics = Array.isArray(f.lead_metrics) ? f.lead_metrics : [];
        return {
          ...f,
          lead_metrics: metrics.map((m: any) => (m.id === metricId ? { ...m, ...patch } : m)),
        };
      })
    );
  };

  const removeLeadMetric = async (funnelId: string, metricId: string) => {
    const nextFunnels = (draftFunnels || []).map((f: any) => {
      if (f.id !== funnelId) return f;
      const metrics = Array.isArray(f.lead_metrics) ? f.lead_metrics : [];
      return { ...f, lead_metrics: metrics.filter((m: any) => m.id !== metricId) };
    });
    setDraftFunnels(nextFunnels);
    // Admin/master salva na empresa; outros salvam pessoal (fallback)
    if (canEditCompanyFilters) {
      const filtersToSave = { ...companyFilters, funnels: buildFunnelsForDb(nextFunnels) };
      await saveCompanyFilters(filtersToSave);
    } else {
      await persistUserReportSettings({ funnels: nextFunnels });
    }
  };

  const saveLeadMetric = async (funnelId: string, metricId: string) => {
    // validação mínima
    const funnel = (draftFunnels || []).find((f: any) => f.id === funnelId);
    const metric = (funnel?.lead_metrics || []).find((m: any) => m.id === metricId);
    if (!metric) return;
    if (!String(metric.title || '').trim()) return;
    if (!metric.pipeline || metric.pipeline === 'all') return;
    if (!metric.column || metric.column === 'all') return;

    const nextFunnels = (draftFunnels || []).map((f: any) => {
      if (f.id !== funnelId) return f;
      const metrics = Array.isArray(f.lead_metrics) ? f.lead_metrics : [];
      return {
        ...f,
        lead_metrics: metrics.map((m: any) => (m.id === metricId ? { ...m, isEditing: false } : m)),
      };
    });
    setDraftFunnels(nextFunnels);
    // Admin/master salva na empresa; outros salvam pessoal (fallback)
    if (canEditCompanyFilters) {
      const filtersToSave = { ...companyFilters, funnels: buildFunnelsForDb(nextFunnels) };
      await saveCompanyFilters(filtersToSave);
    } else {
      await persistUserReportSettings({ funnels: nextFunnels });
    }
  };

  const normalizeText = (s?: string | null) =>
    (s || '')
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

  const fetchColumnsForPipeline = async (pipelineId: string) => {
    if (!pipelineId || pipelineId === 'all' || (pipelineColumnsMap[pipelineId] && pipelineColumnsMap[pipelineId].length > 0)) return;
    
    setLoadingColumnsMap(prev => ({ ...prev, [pipelineId]: true }));
    try {
      const { data, error } = await supabase
        .from('pipeline_columns')
        .select('id, name')
        .eq('pipeline_id', pipelineId)
        // `order_position`/`position` variam entre schemas; `name` é o mais consistente
        .order('name', { ascending: true });
      
      if (error) {
        console.error(`❌ Erro ao buscar colunas para ${pipelineId}:`, error);
        throw error;
      }
      
      setPipelineColumnsMap(prev => ({ ...prev, [pipelineId]: data || [] }));
    } catch (e) {
      console.error(`❌ Falha na busca de colunas:`, e);
    } finally {
      setLoadingColumnsMap(prev => ({ ...prev, [pipelineId]: false }));
    }
  };

  // Efeito para garantir que as colunas sejam carregadas ao editar ou carregar conversões
  useEffect(() => {
    customConversions.forEach(conv => {
      if (conv.pipelineA && conv.pipelineA !== 'all' && !pipelineColumnsMap[conv.pipelineA]) {
        fetchColumnsForPipeline(conv.pipelineA);
      }
      if (conv.pipelineB && conv.pipelineB !== 'all' && !pipelineColumnsMap[conv.pipelineB]) {
        fetchColumnsForPipeline(conv.pipelineB);
      }
    });
  }, [customConversions, pipelineColumnsMap]);

  // Garantir que colunas existam também para pipelines usados nas métricas (evita precisar "trocar pipeline" para carregar)
  useEffect(() => {
    if (!editingMetricsFunnelId) return;
    const funnel = (draftFunnels || []).find((f: any) => f.id === editingMetricsFunnelId);
    const metrics = Array.isArray(funnel?.lead_metrics) ? funnel.lead_metrics : [];
    metrics.forEach((m: any) => {
      const pid = String(m?.pipeline || 'all');
      if (pid && pid !== 'all' && !pipelineColumnsMap[pid]) {
        fetchColumnsForPipeline(pid);
      }
    });
  }, [editingMetricsFunnelId, draftFunnels, pipelineColumnsMap]);

  // ✅ Deriva o range do gráfico a partir dos filtros de cada funil.
  const requiredDataRangeFromFunnels = useMemo(() => {
    let minFrom: Date | null = null;
    let maxTo: Date | null = null;
    (draftFunnels || []).forEach((f: any) => {
      const groups = normalizeFunnelGroups(f?.filters);
      (groups || []).forEach((g: any) => {
        const from = g?.dateRange?.from instanceof Date ? g.dateRange.from : (g?.dateRange?.from ? new Date(g.dateRange.from) : null);
        const to = g?.dateRange?.to instanceof Date ? g.dateRange.to : (g?.dateRange?.to ? new Date(g.dateRange.to) : null);
        if (from && !Number.isNaN(from.getTime())) {
          minFrom = !minFrom || from.getTime() < minFrom.getTime() ? from : minFrom;
        }
        if (to && !Number.isNaN(to.getTime())) {
          maxTo = !maxTo || to.getTime() > maxTo.getTime() ? to : maxTo;
        }
      });
    });
    return { from: minFrom, to: maxTo };
  }, [draftFunnels, rehydrateNonce]);

  const fetchData = async (fetchKey?: string, retryCount = 0) => {
    if (!user?.id) {
      return;
    }
    const fetchId = crypto.randomUUID();
    activeFetchIdRef.current = fetchId;
    setIsLoading(true);
    try {
      // ✅ Calcula o range real necessário: união do range global (topo) com os filtros dos funis.
      // Isso garante que se o usuário salvou 7 dias no topo mas tem um funil de 30 dias, buscamos 30 dias.
      const getEffectiveRange = () => {
        let fromDate = startDate;
        let endDateObj = endDate;

        if (requiredDataRangeFromFunnels.from) {
          if (!fromDate || requiredDataRangeFromFunnels.from < fromDate) {
            fromDate = requiredDataRangeFromFunnels.from;
          }
        }
        if (requiredDataRangeFromFunnels.to) {
          if (!endDateObj || requiredDataRangeFromFunnels.to > endDateObj) {
            endDateObj = requiredDataRangeFromFunnels.to;
          }
        }
        return { from: fromDate, to: endDateObj };
      };

      const effectiveRange = getEffectiveRange();
      const from = effectiveRange.from ? effectiveRange.from.toISOString() : null;
      const to = effectiveRange.to ? effectiveRange.to.toISOString() : null;

      // Limpar dados "pesados" — fase 2 repõe
      setContacts([]);
      setActivities([]);
      setTags([]);

      // Modo master: `selectedWorkspaceId === ''` => "todas as empresas"
      // Prioridade: selectedWorkspaceId > lista de workspaces > settingsWorkspaceId > ctxWorkspaces
      let workspaceIds: string[] = [];
      if (selectedWorkspaceId) {
        workspaceIds = [selectedWorkspaceId];
      } else if (Array.isArray(workspaces) && workspaces.length > 0) {
        workspaceIds = workspaces.map((w) => w.workspace_id).filter(Boolean);
      } else if (settingsWorkspaceId) {
        workspaceIds = [settingsWorkspaceId];
      } else if (Array.isArray(ctxWorkspaces) && ctxWorkspaces.length > 0) {
        workspaceIds = ctxWorkspaces.map((w) => w.workspace_id).filter(Boolean);
      }

      if (!workspaceIds || workspaceIds.length === 0) {
        setCards([]);
        setConversations([]);
        setIsLoading(false);
        return;
      }

      // Helper para tentar RPC como fallback
      const tryRpcFallback = async (workspaceId: string, headers: any) => {
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_report_data', {
          p_workspace_id: workspaceId,
          p_from: from,
          p_to: to,
          p_user_id: user?.id || null,
          p_is_user_scoped: false, // Filtragem é feita no frontend baseada no agente selecionado
        });
        
        if (rpcError) {
          throw rpcError;
        }
        
        return rpcData;
      };

      const runWithLimit = async (items: string[], limit: number, fn: (id: string) => Promise<any>) => {
        const results: any[] = [];
        let idx = 0;
        const workers = new Array(Math.max(1, Math.min(limit, items.length))).fill(null).map(async () => {
          while (idx < items.length) {
            const current = items[idx++];
            try {
              results.push(await fn(current));
            } catch (e) {
              results.push({ __error: e, workspaceId: current });
            }
          }
        });
        await Promise.all(workers);
        return results;
      };

      // FASE 1 (rápida): cards core (sem tags/produtos) + conversations
      const phase1ByWs = new Map<string, { cardsLite: any[]; conversations: any[] }>();

      // Criar headers manualmente para evitar dependência do hook useWorkspaceHeaders
      const createHeaders = (wsId: string) => {
        const userData = localStorage.getItem('currentUser');
        const currentUserData = userData ? JSON.parse(userData) : null;
        if (!currentUserData?.id) {
          throw new Error('Usuário não autenticado');
        }
        return {
          'x-system-user-id': currentUserData.id,
          'x-system-user-email': currentUserData.email || '',
          'x-workspace-id': wsId
        };
      };

      const phase1Results = await runWithLimit(workspaceIds, 4, async (workspaceId) => {
        let headers: any;
        try {
          headers = createHeaders(workspaceId);
        } catch (headersError) {
          return { __error: headersError, workspaceId };
        }
        
        let cardsLite: any[] = [];
        let conversationsData: any[] = [];
        try {
          const [cardsRes, baseRes] = await Promise.all([
            supabase.functions.invoke("report-indicator-cards-lite", {
              method: "POST",
              headers,
              body: { workspaceId, from, to, includeRelations: false, userRole },
            }),
            supabase.functions.invoke("report-base-data-lite", {
              method: "POST",
              headers,
              body: {
                workspaceId,
                from,
                to,
                userRole,
                userId: user.id,
                includeContacts: false,
                includeActivities: false,
                includeConversations: true,
              },
            }),
          ]);

          if (cardsRes.error || baseRes.error) {
            const rpcData = await tryRpcFallback(workspaceId, headers);
            cardsLite = Array.isArray(rpcData?.cards) ? rpcData.cards : [];
            conversationsData = Array.isArray(rpcData?.conversations) ? rpcData.conversations : [];
          } else {
            cardsLite = Array.isArray((cardsRes.data as any)?.cards) ? (cardsRes.data as any).cards : [];
            conversationsData = Array.isArray((baseRes.data as any)?.conversations)
              ? (baseRes.data as any).conversations
              : [];
          }
        } catch (edgeFnError) {
          // Retry global somente quando for workspace único (evita tempestade no "todas as empresas")
          if (workspaceIds.length === 1 && retryCount < 2) {
            await new Promise(r => setTimeout(r, 1000 * (retryCount + 1)));
            return fetchData(fetchKey, retryCount + 1);
          }
          // Fallback RPC por workspace
          const rpcData = await tryRpcFallback(workspaceId, headers);
          cardsLite = Array.isArray(rpcData?.cards) ? rpcData.cards : [];
          conversationsData = Array.isArray(rpcData?.conversations) ? rpcData.conversations : [];
        }
        return { workspaceId, cardsLite, conversationsData };
      });

      if (activeFetchIdRef.current !== fetchId) return;

      phase1Results.forEach((r: any) => {
        if (!r || r.__error) return;
        phase1ByWs.set(r.workspaceId, {
          cardsLite: Array.isArray(r.cardsLite) ? r.cardsLite : [],
          conversations: Array.isArray(r.conversationsData) ? r.conversationsData : [],
        });
      });

      const allCardsLite = Array.from(phase1ByWs.values()).flatMap((v) => v.cardsLite || []);
      const allConversations = Array.from(phase1ByWs.values()).flatMap((v) => v.conversations || []);

      if (activeFetchIdRef.current !== fetchId) return;

      // Normaliza cards vindos da Edge Function LITE para o shape usado nos indicadores
      const toNumberOrNull = (v: any) => {
        if (v === null || v === undefined || v === '') return null;
        if (typeof v === 'number') return Number.isFinite(v) ? v : null;
        const parsed = Number(String(v).replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : null;
      };
      let cardsFiltered = (allCardsLite || []).map((c: any) => ({
        id: c.id,
        contact_id: c.contact_id || null,
        value: toNumberOrNull(c.value ?? c.total_value ?? c.amount ?? null),
        status: c.status ?? null,
        qualification: c.qualification ?? null,
        pipeline_id: c.pipeline_id ?? null,
        column_id: c.column_id ?? null,
        responsible_user_id: c.responsible_user_id ?? null,
        created_at: c.created_at ?? null,
        updated_at: c.updated_at ?? null,
        closed_at: c.closed_at ?? null,
        won_at: c.won_at ?? null,
        products: [],
      }));

      const conversationsFiltered = (allConversations || []);

      setCards(cardsFiltered);
      setConversations(conversationsFiltered);

      // Libera a UI já na fase 1
      setIsLoading(false);

      // FASE 2 (background): relations (tags/produtos), contacts/activities e ranking
      (async () => {
        try {
          const currentFetchId = fetchId;
          const wsList = Array.from(phase1ByWs.keys());
          const phase2Results = await runWithLimit(wsList, 3, async (workspaceId) => {
            const headers = createHeaders(workspaceId);
            const cardIds = (phase1ByWs.get(workspaceId)?.cardsLite || []).map((c: any) => c?.id).filter(Boolean);

            const [relationsRes, baseHeavyRes] = await Promise.allSettled([
              cardIds.length
                ? supabase.functions.invoke("report-indicator-cards-lite", {
                    method: "POST",
                    headers,
                    body: { workspaceId, from, to, includeRelations: true, cardIds, userRole },
                  })
                : Promise.resolve({ data: { cards: [] }, error: null } as any),
              supabase.functions.invoke("report-base-data-lite", {
                method: "POST",
                headers,
                body: {
                  workspaceId,
                  from,
                  to,
                  userRole,
                  userId: user.id,
                  includeContacts: true,
                  includeActivities: true,
                  includeConversations: false,
                },
              }),
            ]);

            return { workspaceId, relationsRes, baseHeavyRes };
          });

          if (activeFetchIdRef.current !== currentFetchId) return;

          // relations (tags/produtos)
          const relCardsAll: any[] = [];
          const contactsAll: any[] = [];
          const activitiesAll: any[] = [];

          phase2Results.forEach((r: any) => {
            const relationsRes = r?.relationsRes;
            const baseHeavyRes = r?.baseHeavyRes;

            if (relationsRes?.status === "fulfilled" && !(relationsRes.value as any)?.error) {
              const relCards = Array.isArray((((relationsRes.value as any)?.data as any) || {})?.cards)
                ? ((((relationsRes.value as any)?.data as any) || {})?.cards as any[])
                : [];
              relCardsAll.push(...relCards);
            }

            if (baseHeavyRes?.status === "fulfilled" && !(baseHeavyRes.value as any)?.error) {
              const d = ((baseHeavyRes.value as any)?.data as any) || {};
              const contactsData = Array.isArray(d?.contacts) ? d.contacts : [];
              const activitiesData = Array.isArray(d?.activities) ? d.activities : [];
              contactsAll.push(...contactsData);
              activitiesAll.push(...activitiesData);
            }
          });

          if (relCardsAll.length > 0) {
            const relById = new Map(relCardsAll.map((c: any) => [c.id, c]));

            setCards((prev) =>
              (prev || []).map((c: any) => {
                const rel = relById.get(c.id);
                if (!rel) return c;
                return {
                  ...c,
                  // Mantém compatível com o resto do arquivo: repõe products via snapshots (não bloqueia nomes/valores)
                  products:
                    Array.isArray(rel.product_items) && rel.product_items.length > 0
                      ? rel.product_items.map((pi: any) => ({
                          product_id: pi.product_id ?? null,
                          product_name_snapshot: pi.product_name_snapshot ?? null,
                          quantity: pi.quantity ?? 1,
                          unit_value: pi.unit_value ?? null,
                          total_value: pi.total_value ?? null,
                          product: null,
                        }))
                      : c.products,
                };
              })
            );

      const tagRows: any[] = [];
            relCardsAll.forEach((card: any) => {
        const contactId = card.contact_id;
        const tagIds = Array.isArray(card.tag_ids) ? card.tag_ids : [];
        if (!contactId) return;
        tagIds.forEach((tagId: string) => {
          if (!tagId) return;
          tagRows.push({ contact_id: contactId, tag_id: tagId });
        });
      });
      setTags(tagRows);
          }

          // contacts/activities (merge)
          setContacts(contactsAll);
          setActivities(activitiesAll);

          // Buscar histórico de movimentação de cards (para métricas de conversão baseadas em histórico)
          try {
            const cardIds = allCardsLite.map((c: any) => c?.id).filter(Boolean);
            if (cardIds.length > 0) {
              const { data: historyData, error: historyError } = await supabase
                .from('pipeline_card_history')
                .select('card_id, metadata, changed_at')
                .in('card_id', cardIds)
                .eq('action', 'column_changed')
                .gte('changed_at', from || '1970-01-01')
                .lte('changed_at', to || '2099-12-31')
                .order('changed_at', { ascending: true });
              
              if (!historyError && Array.isArray(historyData)) {
                const historyRecords: CardColumnHistoryRecord[] = historyData.map((h: any) => ({
                  card_id: h.card_id,
                  old_column_id: (h.metadata as any)?.old_column_id || null,
                  new_column_id: (h.metadata as any)?.new_column_id || null,
                  changed_at: h.changed_at,
                }));
                setCardColumnHistory(historyRecords);
              }
            }
          } catch (historyErr) {
            console.warn('Erro ao buscar histórico de movimentação (não crítico):', historyErr);
          }

        } catch (e) {
        }
      })();
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
    } finally {
      // A fase 1 já desliga o loading; aqui é só “garantia” em caso de erro antes disso.
      if (activeFetchIdRef.current === fetchId) setIsLoading(false);
    }
  };

  useEffect(() => {
    // Se workspaces for fornecido (master-dashboard), não sobrescrever selectedWorkspaceId vazio
    // Caso contrário, sincronizar com o workspace selecionado
    if (workspaces && workspaces.length > 0) {
      // Master-dashboard: manter selectedWorkspaceId como está (pode ser vazio para todos os workspaces)
      return;
    }
    
    // Prioriza o workspace do contexto; se faltar, usa o primeiro disponível das props ou contexto.
    const fallbackWs =
      selectedWorkspace?.workspace_id ||
      ctxWorkspaces?.[0]?.workspace_id ||
      '';
    
    if (fallbackWs && fallbackWs !== selectedWorkspaceId) {
      setSelectedWorkspaceId(fallbackWs);
    }
  }, [selectedWorkspace?.workspace_id, workspaces?.length, ctxWorkspaces?.length, selectedWorkspaceId]);

  useEffect(() => {
    setIsHydrated(false);
    lastFetchKeyRef.current = null;
    if (settingsWorkspaceId) {
      // Pipelines: usar contexto se já carregado; caso contrário, buscar direto.
      if (ctxPipelines && ctxPipelines.length > 0) {
        setPipelines(ctxPipelines);
      } else {
        fetchPipelines(settingsWorkspaceId);
        fetchCtxPipelines?.(); // dispara fetch global do contexto
      }
      fetchTags(settingsWorkspaceId);
      fetchProducts(settingsWorkspaceId);
      fetchAgents(settingsWorkspaceId);
      // Reset filtros quando workspace mudar
      setSelectedFunnel('all');
      setSelectedTags([]);
      setSelectedAgent('all');
    } else {
      setPipelines([]);
      setAvailableTags([]);
      setAgents([]);
    }
  }, [settingsWorkspaceId]);

  // Inicializa o draft a partir das configurações do usuário (DB).
  // Fallback: usa o preset padrão do workspace (read-only para users comuns).
  const normalizeSavedDate = (value?: string | null, endOfDayFlag = false) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return endOfDayFlag ? endOfDay(parsed) : startOfDay(parsed);
  };

  const datesEqual = (a?: Date | null, b?: Date | null) => {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return a.getTime() === b.getTime();
  };

  const arraysEqual = (a?: string[], b?: string[]) => {
    if (!Array.isArray(a) && !Array.isArray(b)) return true;
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((value, index) => value === b[index]);
  };

  // Ref para controlar se já foi hidratado uma vez (evita "tremor" por re-hidratações)
  const hasHydratedOnceRef = useRef(false);
  const lastHydratedWorkspaceRef = useRef<string | null>(null);

  useEffect(() => {
    // Bloqueia qualquer lógica se não houver usuário ou workspace selecionado
    if (!user?.id || !settingsWorkspaceId) return;

    // Enquanto estiver carregando as configurações do usuário ou da empresa, não faz nada
    if (loadingUserSettings || loadingCompanyFilters) return;

    // ✅ Se mudou de workspace, permite re-hidratação
    if (lastHydratedWorkspaceRef.current !== settingsWorkspaceId) {
      hasHydratedOnceRef.current = false;
      setIsHydrated(false);
    }

    // ✅ CRÍTICO: Evita "tremor" - só hidrata uma vez por sessão/workspace
    // Se já hidratou e as configurações mudaram (outro admin salvou), ignora
    // O usuário verá as mudanças ao recarregar a página
    if (hasHydratedOnceRef.current && isHydrated) return;

    // 1️⃣ Primeiro: Aplica filtros da empresa (padrão para todos)
    if (companyFilters && typeof companyFilters === 'object') {
      const cf = companyFilters;
      
      // Conversão Customizada
      if (cf.customConv) {
        const preset = (cf.customConv.periodPreset as any) || 'last30';
        setCustomConvPeriodPreset(preset);
        const derived = applyPresetToRange(preset);
        setCustomConvStartDate(derived.from);
        setCustomConvEndDate(derived.to);
        setCustomConvAgent(cf.customConv.agent || 'all');
        setCustomConvTags(Array.isArray(cf.customConv.tags) ? cf.customConv.tags : []);
        setCustomConvStatus((cf.customConv.status as any) || 'all');
      }
      
      // Conversão Equipe
      if (cf.teamConv) {
        const preset = (cf.teamConv.periodPreset as any) || 'last30';
        setTeamConvPeriodPreset(preset);
        const derived = applyPresetToRange(preset);
        setTeamConvStartDate(derived.from);
        setTeamConvEndDate(derived.to);
        setTeamConvAgent(cf.teamConv.agent || 'all');
        setTeamConvTags(Array.isArray(cf.teamConv.tags) ? cf.teamConv.tags : []);
        setTeamConvStatus((cf.teamConv.status as any) || 'all');
      }
      
      // Ranking Vendas
      if (cf.salesRanking) {
        const preset = (cf.salesRanking.periodPreset as any) || 'last30';
        setSalesRankingPreset(preset);
        const derived = applyPresetToRange(preset);
        setSalesRankingStartDate(derived.from);
        setSalesRankingEndDate(derived.to);
        if (Array.isArray(cf.salesRanking.visibleUsers)) {
          setSalesRankingUsers(cf.salesRanking.visibleUsers);
        }
      }
      
      // Ranking Trabalho
      if (cf.workRanking) {
        const preset = (cf.workRanking.periodPreset as any) || 'last30';
        setWorkRankingPreset(preset);
        const derived = applyPresetToRange(preset);
        setWorkRankingStartDate(derived.from);
        setWorkRankingEndDate(derived.to);
        if (Array.isArray(cf.workRanking.visibleUsers)) {
          setWorkRankingUsers(cf.workRanking.visibleUsers);
        }
      }
    }

    // 2️⃣ Depois: Aplica configurações
    // Todos os usuários (incluindo admin/master) veem os filtros da empresa
    // Isso garante que quando admin salva para empresa, ele vê o que salvou
    let sourceFunnels: any[];
    // Sempre prioriza os dados da empresa (companyFilters) para funnels
    sourceFunnels = (companyFilters?.funnels && Array.isArray(companyFilters.funnels) && companyFilters.funnels.length > 0)
      ? companyFilters.funnels
      : (savedFunnels || []);

    const normalizeLeadMetrics = (metricsRaw: any[] | undefined) =>
      (Array.isArray(metricsRaw) ? metricsRaw : [])
        .map((m: any, idx: number) => ({
          id: String(m?.id || `metric-${idx + 1}-${crypto.randomUUID()}`),
          title: String(m?.title || m?.name || 'Métrica'),
          pipeline: String(m?.pipeline || 'all'),
          column: String(m?.column || 'all'),
          isEditing: false,
        }))
        .filter((m: any) => m.id && m.title);

    const normalized = (sourceFunnels || []).map((f: any, idx: number) => ({
      id: String(f.id || `funnel-${idx + 1}`),
      name: String(f.name || `Funil ${idx + 1}`),
      filters: normalizeFunnelGroups(Array.isArray(f.filters) ? f.filters : []),
      lead_metrics: normalizeLeadMetrics(f.lead_metrics),
    }));

    setDraftFunnels(normalized);
    setRehydrateNonce((n) => n + 1);

    // Restaura outros filtros (exceto o filtro global de datas que agora é fixo em last30)
    const gf = (userSettings as any)?.globalFilter;
    if (gf && typeof gf === 'object') {
      if (gf.agent) setSelectedAgent(gf.agent);
      if (gf.funnel) setSelectedFunnel(gf.funnel);
      if (Array.isArray(gf.tags)) setSelectedTags(gf.tags);
    }

    // Carregar conversões da empresa (companyFilters) - sempre prioriza dados da empresa
    const companyCustomConv = (companyFilters as any)?.customConversions;
    const companyTeamConv = (companyFilters as any)?.teamConversions;
    
    // Sempre usa dados da empresa se existir (mesmo array vazio significa "limpo pela empresa")
    if (Array.isArray(companyCustomConv)) {
      setCustomConversions(companyCustomConv.map((c: any) => ({ ...c, isEditing: false })));
    } else if (Array.isArray(userSettings?.customConversions)) {
      // Fallback legado - apenas se empresa nunca salvou nada
      setCustomConversions((userSettings!.customConversions as any[]).map((c: any) => ({ ...c, isEditing: false })));
    }
    
    if (Array.isArray(companyTeamConv)) {
      setTeamConversions(companyTeamConv.map((c: any) => ({ ...c, isEditing: false })));
    } else if (Array.isArray(userSettings?.teamConversions)) {
      // Fallback legado - apenas se empresa nunca salvou nada
      setTeamConversions((userSettings!.teamConversions as any[]).map((c: any) => ({ ...c, isEditing: false })));
    }

    const cc = (userSettings as any)?.customConversionsFilter;
    if (cc && typeof cc === 'object') {
      const preset = (cc.preset as any) || 'last30';
      setCustomConvPeriodPreset(preset);
      const derived = applyPresetToRange(preset);
      const useSavedRange = preset === 'custom';
      setCustomConvStartDate(useSavedRange && cc.startDate ? new Date(cc.startDate) : derived.from);
      setCustomConvEndDate(useSavedRange && cc.endDate ? new Date(cc.endDate) : derived.to);
      setCustomConvAgent(cc.agent || 'all');
      setCustomConvTags(Array.isArray(cc.tags) ? cc.tags.filter(Boolean) : []);
      setCustomConvStatus((cc.status as any) || 'all');
    }
    const tc = (userSettings as any)?.teamConversionsFilter;
    if (tc && typeof tc === 'object') {
      const preset = (tc.preset as any) || 'last30';
      setTeamConvPeriodPreset(preset);
      const derived = applyPresetToRange(preset);
      const useSavedRange = preset === 'custom';
      setTeamConvStartDate(useSavedRange && tc.startDate ? new Date(tc.startDate) : derived.from);
      setTeamConvEndDate(useSavedRange && tc.endDate ? new Date(tc.endDate) : derived.to);
      setTeamConvAgent(tc.agent || 'all');
      setTeamConvTags(Array.isArray(tc.tags) ? tc.tags.filter(Boolean) : []);
      setTeamConvStatus((tc.status as any) || 'all');
    }

    // Marca como hidratado e libera a UI
    setIsHydrated(true);
    hasHydratedOnceRef.current = true;
    lastHydratedWorkspaceRef.current = settingsWorkspaceId;

    // ✅ CRÍTICO: Removido userSettings das dependências para evitar loop infinito
  }, [savedFunnels, user?.id, userRole, loadingUserSettings, loadingCompanyFilters, settingsWorkspaceId, isHydrated]);

  // ✅ Disparar fetchData quando houver contexto válido
  useEffect(() => {
    // Precisa de usuário E (workspace específico OU lista de workspaces para modo "todas as empresas")
    const hasWorkspaceContext = settingsWorkspaceId || (Array.isArray(workspaces) && workspaces.length > 0);
    if (!user?.id || !hasWorkspaceContext) {
      return;
    }

    const key = JSON.stringify({
      // selectedWorkspaceId vazio = "todas as empresas"
      ws: selectedWorkspaceId || 'all',
      // garante refetch quando a lista de empresas do master carregar/alterar
      wsLen: Array.isArray(workspaces) ? workspaces.length : 0,
      wsFirst: Array.isArray(workspaces) ? (workspaces[0]?.workspace_id || null) : null,
      preset: periodPreset,
      start: startDate ? startDate.toISOString() : null,
      end: endDate ? endDate.toISOString() : null,
      agent: selectedAgent,
      role: userRole,
      funnel: selectedFunnel,
      tags: selectedTags,
    });

    if (lastFetchKeyRef.current === key) {
      return;
    }
    
    lastFetchKeyRef.current = key;
    
    // Chamar diretamente sem debounce - o debounce estava sendo cancelado por re-renders
    fetchData(key);
    
  }, [periodPreset, startDate, endDate, selectedAgent, userRole, selectedFunnel, selectedTags, selectedWorkspaceId, settingsWorkspaceId, user?.id, workspaces?.length]);

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEndCustomConversions = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    setCustomConversions((prev) => {
      const oldIndex = prev.findIndex((c: any) => String(c.id) === String(active.id));
      const newIndex = prev.findIndex((c: any) => String(c.id) === String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      saveCompanyConversions({ customConversions: next });
      return next;
    });
  };

  const onDragEndTeamConversions = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    setTeamConversions((prev) => {
      const oldIndex = prev.findIndex((c: any) => String(c.id) === String(active.id));
      const newIndex = prev.findIndex((c: any) => String(c.id) === String(over.id));
      if (oldIndex < 0 || newIndex < 0) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      saveCompanyConversions({ teamConversions: next });
      return next;
    });
  };

  // --- Filtros globais (no topo) para as seções de conversão ---
  type ConversionPeriodPreset = 'all' | 'today' | 'last7' | 'last30' | 'custom';
  const [customConvPeriodPreset, setCustomConvPeriodPreset] = useState<ConversionPeriodPreset>('last30');
  const [customConvStartDate, setCustomConvStartDate] = useState<Date | null>(startOfDay(subDays(new Date(), 29)));
  const [customConvEndDate, setCustomConvEndDate] = useState<Date | null>(endOfDay(new Date()));
  const [teamConvPeriodPreset, setTeamConvPeriodPreset] = useState<ConversionPeriodPreset>('last30');
  const [teamConvStartDate, setTeamConvStartDate] = useState<Date | null>(startOfDay(subDays(new Date(), 29)));
  const [teamConvEndDate, setTeamConvEndDate] = useState<Date | null>(endOfDay(new Date()));

  type HumanStatusFilter = 'all' | 'open' | 'won' | 'lost';
  const [customConvAgent, setCustomConvAgent] = useState<string>('all'); // 'all' | 'ia' | userId
  const [customConvTags, setCustomConvTags] = useState<string[]>([]);
  const [customConvStatus, setCustomConvStatus] = useState<HumanStatusFilter>('all');
  const [teamConvAgent, setTeamConvAgent] = useState<string>('all');
  const [teamConvTags, setTeamConvTags] = useState<string[]>([]);
  const [teamConvStatus, setTeamConvStatus] = useState<HumanStatusFilter>('all');

  // Ranking – Vendas/Trabalho (filtros de período locais)
  const [salesRankingPreset, setSalesRankingPreset] = useState<ConversionPeriodPreset>('last30');
  const [salesRankingStartDate, setSalesRankingStartDate] = useState<Date | null>(startOfDay(subDays(new Date(), 29)));
  const [salesRankingEndDate, setSalesRankingEndDate] = useState<Date | null>(endOfDay(new Date()));
  const [workRankingPreset, setWorkRankingPreset] = useState<ConversionPeriodPreset>('last30');
  const [workRankingStartDate, setWorkRankingStartDate] = useState<Date | null>(startOfDay(subDays(new Date(), 29)));
  const [workRankingEndDate, setWorkRankingEndDate] = useState<Date | null>(endOfDay(new Date()));
  
  // Filtro de usuários visíveis nos rankings (admin/master configura, todos veem)
  const [salesRankingUsers, setSalesRankingUsers] = useState<string[]>([]); // vazio = todos
  const [workRankingUsers, setWorkRankingUsers] = useState<string[]>([]); // vazio = todos
  
  const [salesRankingRows, setSalesRankingRows] = useState<any[]>([]);
  const [salesRankingLoading, setSalesRankingLoading] = useState(false);

  // Estado separado para dados do ranking de trabalho (busca específica por período)
  const [workRankingData, setWorkRankingData] = useState<TeamWorkRankingRow[]>([]);
  const [workRankingLoading, setWorkRankingLoading] = useState(false);

  const applyPresetToRange = (preset: ConversionPeriodPreset) => {
    const now = new Date();
    if (preset === 'today') {
      return { from: startOfDay(now), to: endOfDay(now) };
    }
    if (preset === 'last7') {
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    }
    if (preset === 'last30') {
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    }
    return { from: null, to: null };
  };

  const withinRange = (iso?: string, from?: Date | null, to?: Date | null) => {
    if (!from && !to) return true;
    if (!iso) return true;
    const t = new Date(iso).getTime();
    if (Number.isNaN(t)) return true;
    if (from) {
      const fromT = startOfDay(from).getTime();
      if (t < fromT) return false;
    }
    if (to) {
      const toT = endOfDay(to).getTime();
      if (t > toT) return false;
    }
    return true;
  };

  /**
   * Verifica se um card passou por uma coluna específica durante o período filtrado.
   * Considera o histórico de movimentação para métricas de conversão mais precisas.
   * 
   * Lógica:
   * 1. Se o card está atualmente na coluna, conta
   * 2. Se o card passou pela coluna no período (entrou ou saiu), conta
   * 3. Se o card já estava na coluna antes do período e saiu durante, conta
   */
  const cardPassedThroughColumn = (
    card: PipelineCardRecord,
    columnId: string,
    fromDate: Date | null,
    toDate: Date | null
  ): boolean => {
    // Se a coluna é "all", sempre retorna true (sem filtro de coluna)
    if (columnId === 'all') return true;
    
    // Caso 1: Card está atualmente na coluna
    if (card.column_id === columnId) return true;
    
    // Caso 2 e 3: Verificar histórico de movimentação
    const cardHistory = cardColumnHistory.filter(h => h.card_id === card.id);
    if (cardHistory.length === 0) {
      // Sem histórico, só conta se está na coluna atualmente
      return card.column_id === columnId;
    }
    
    // Verificar se alguma movimentação envolveu essa coluna no período
    const fromTime = fromDate ? startOfDay(fromDate).getTime() : 0;
    const toTime = toDate ? endOfDay(toDate).getTime() : Date.now();
    
    for (const h of cardHistory) {
      const changeTime = new Date(h.changed_at).getTime();
      
      // Verificar se a movimentação está dentro do período
      if (changeTime >= fromTime && changeTime <= toTime) {
        // Card entrou ou saiu desta coluna durante o período
        if (h.old_column_id === columnId || h.new_column_id === columnId) {
          return true;
        }
      }
      
      // Verificar se card já estava na coluna antes do período e saiu durante
      if (changeTime >= fromTime && h.old_column_id === columnId) {
        return true;
      }
    }
    
    // Verificar se card estava na coluna no início do período (antes da primeira movimentação)
    const firstMoveInPeriod = cardHistory.find(h => {
      const t = new Date(h.changed_at).getTime();
      return t >= fromTime;
    });
    
    if (firstMoveInPeriod && firstMoveInPeriod.old_column_id === columnId) {
      return true;
    }
    
    return false;
  };

  // ✅ Para relatórios: "data da atividade" deve refletir o dia do evento (agendada/concluída),
  // não apenas quando foi criada no banco.
  const getActivityDateIso = (a: any): string | undefined => {
    return a?.completed_at || a?.scheduled_for || a?.created_at;
  };

  const getEffectiveRange = (preset: ConversionPeriodPreset, from: Date | null, to: Date | null) => {
    if (preset === 'custom') return { from, to };
    if (preset === 'all') return { from: null, to: null };
    return applyPresetToRange(preset);
  };

  const toDateOnly = (d?: Date | null) => {
    if (!d) return null;
    return format(d, 'yyyy-MM-dd');
  };

  // Ranking de vendas via VIEW
  useEffect(() => {
    const fetchSalesRankingRows = async () => {
      if (!selectedWorkspaceId) return;

      setSalesRankingLoading(true);
      try {
        const { from, to } = getEffectiveRange(salesRankingPreset, salesRankingStartDate, salesRankingEndDate);
        const fromDate = toDateOnly(from);
        const toDate = toDateOnly(to);

        let query = supabase
          .from('report_sales_ranking_view' as any)
          .select('responsible_user_id, revenue, products_qty, card_date')
          .eq('workspace_id', selectedWorkspaceId);

        if (fromDate) query = query.gte('card_date', fromDate);
        if (toDate) query = query.lte('card_date', toDate);

        const { data, error } = await query;
        if (!error && data) {
          setSalesRankingRows(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error("[Relatórios] Erro ao buscar ranking de vendas (view):", e);
      } finally {
        setSalesRankingLoading(false);
      }
    };

    fetchSalesRankingRows();
  }, [selectedWorkspaceId, salesRankingPreset, salesRankingStartDate, salesRankingEndDate]);

  // useEffect para buscar dados do ranking de trabalho quando os filtros específicos mudarem
  useEffect(() => {
    const fetchWorkRankingData = async () => {
      if (!selectedWorkspaceId) return;
      
      setWorkRankingLoading(true);
      try {
        const { from, to } = getEffectiveRange(workRankingPreset, workRankingStartDate, workRankingEndDate);
        
        // Usa a função RPC que trata acentos corretamente
        const { data, error } = await supabase.rpc('report_team_work_ranking', {
          p_workspace_id: selectedWorkspaceId,
          p_from: from ? from.toISOString() : null,
          p_to: to ? to.toISOString() : null,
          p_responsible_id: null
        });

        if (!error && data) {
          const rows = (data as any[]).map((row) => ({
            responsible_id: row.responsible_id,
            mensagem: Number(row.mensagem || 0),
            ligacao_nao_atendida: Number(row.ligacao_nao_atendida || 0),
            ligacao_atendida: Number(row.ligacao_atendida || 0),
            ligacao_abordada: Number(row.ligacao_abordada || 0),
            ligacao_agendada: Number(row.ligacao_agendada || 0),
            ligacao_follow_up: Number(row.ligacao_follow_up || 0),
            reuniao_agendada: Number(row.reuniao_agendada || 0),
            reuniao_realizada: Number(row.reuniao_realizada || 0),
            reuniao_nao_realizada: Number(row.reuniao_nao_realizada || 0),
            reuniao_reagendada: Number(row.reuniao_reagendada || 0),
            whatsapp_enviado: Number(row.whatsapp_enviado || 0),
            proposta_enviada: Number(row.proposta_enviada || 0),
            venda_realizada: Number(row.venda_realizada || 0)
          }));
          setWorkRankingData(rows);
        } else if (error) {
          console.error("[Relatórios] Erro na RPC ranking de trabalho:", error);
        }
      } catch (e) {
        console.error("[Relatórios] Erro ao buscar ranking de trabalho:", e);
      } finally {
        setWorkRankingLoading(false);
      }
    };
    
    fetchWorkRankingData();
  }, [selectedWorkspaceId, workRankingPreset, workRankingStartDate, workRankingEndDate]);

  const getTeamMetricCountForRange = (metricKey: TeamMetricKey, rangeFrom?: Date | null, rangeTo?: Date | null) => {
    if (metricKey === 'leads') {
      return (cardsScoped || []).filter((c: any) => withinRange(c?.created_at, rangeFrom, rangeTo)).length;
    }
    const rawLabel = String(metricKey).replace(/^activity:/, '');
    const k = normalizeText(rawLabel);
    return (activitiesScoped || []).filter((a: any) => {
      if (!withinRange(getActivityDateIso(a), rangeFrom, rangeTo)) return false;
      return normalizeText(a?.type) === k;
    }).length;
  };

  const isWonStatus = (s?: string | null) => {
    const v = (s || '').toLowerCase();
    return v === 'won' || v === 'ganho' || v === 'venda' || v === 'success' || v === 'sucesso';
  };
  const isLostStatus = (s?: string | null) => {
    const v = (s || '').toLowerCase();
    return v.startsWith('lost') || v === 'perdido' || v === 'lost';
  };

  const buildAllowedContactIdsByTags = (tagIds: string[]) => {
    if (!tagIds || tagIds.length === 0) return null;
    const allowed = new Set<string>();
    (tags || []).forEach((t: any) => {
      if (!t?.contact_id || !t?.tag_id) return;
      if (!tagIds.includes(t.tag_id)) return;
      allowed.add(t.contact_id);
    });
    return allowed;
  };

  const filterCardsForSection = (
    list: any[],
    rangeFrom: Date | null,
    rangeTo: Date | null,
    agent: string,
    tagIds: string[],
    status: HumanStatusFilter
  ) => {
    const allowedContacts = buildAllowedContactIdsByTags(tagIds);
    return (list || [])
      .filter((c: any) => withinRange(c?.created_at, rangeFrom, rangeTo))
      .filter((c: any) => {
        if (agent === 'all') return true;
        if (agent === 'ia') return !c?.responsible_user_id;
        return String(c?.responsible_user_id || '') === String(agent);
      })
      .filter((c: any) => {
        if (!allowedContacts) return true;
        if (!c?.contact_id) return false;
        return allowedContacts.has(c.contact_id);
      })
      .filter((c: any) => {
        if (status === 'all') return true;
        if (status === 'won') return isWonStatus(c?.status);
        if (status === 'lost') return isLostStatus(c?.status);
        // open
        return !isWonStatus(c?.status) && !isLostStatus(c?.status);
      });
  };

  const filterActivitiesForSection = (list: any[], rangeFrom: Date | null, rangeTo: Date | null, agent: string, tagIds: string[]) => {
    const allowedContacts = buildAllowedContactIdsByTags(tagIds);
    return (list || [])
      .filter((a: any) => withinRange(getActivityDateIso(a), rangeFrom, rangeTo))
      .filter((a: any) => {
        if (agent === 'all') return true;
        if (agent === 'ia') return !a?.responsible_id;
        return String(a?.responsible_id || '') === String(agent);
      })
      .filter((a: any) => {
        if (!allowedContacts) return true;
        if (!a?.contact_id) return false;
        return allowedContacts.has(a.contact_id);
      });
  };

  const getTeamActivityMetricCount = (metricKey: TeamMetricKey, activitiesList: any[]) => {
    const rawLabel = String(metricKey).replace(/^activity:/, '');
    const normalizedLabel = normalizeText(rawLabel);

    const isCallType = (a: any) => {
      const t = norm(a?.type);
      return t.includes('ligação') || t.includes('ligacao') || t.includes('chamada');
    };

    const isMeetingType = (a: any) => {
      const t = norm(a?.type);
      return t.includes('reunião') || t.includes('reuniao');
    };

    switch (normalizedLabel) {
      case normalizeText('Mensagem'):
        return activitiesList.filter((a: any) => norm(a?.type).includes('mensagem')).length;
      case normalizeText('Ligação Não Atendida'):
        return activitiesList.filter((a: any) => norm(a?.type).includes('ligação não atendida') || norm(a?.type).includes('ligacao nao atendida') || norm(a?.type).includes('ligacao não atendida')).length;
      case normalizeText('Ligação Atendida'):
        return activitiesList.filter((a: any) => norm(a?.type).includes('ligação atendida') || norm(a?.type).includes('ligacao atendida')).length;
      case normalizeText('Ligação Abordada'):
        return activitiesList.filter((a: any) => norm(a?.type).includes('ligação abordada') || norm(a?.type).includes('ligacao abordada') || norm(a?.status).includes('abordada')).length;
      case normalizeText('Ligação Agendada'):
        return activitiesList.filter((a: any) => isCallType(a) && (norm(a?.type).includes('agendada') || norm(a?.status).includes('agendada'))).length;
      case normalizeText('Ligação de Follow up'):
        return activitiesList.filter((a: any) => norm(a?.type).includes('follow') || norm(a?.status).includes('follow')).length;
      case normalizeText('Reunião Agendada'):
        return activitiesList.filter((a: any) => isMeetingType(a)).length;
      case normalizeText('Reunião Realizada'):
        return activitiesList.filter((a: any) => norm(a?.type).includes('realizada') || norm(a?.status).includes('realizada')).length;
      case normalizeText('Reunião Não Realizada'):
        return activitiesList.filter((a: any) => norm(a?.type).includes('não realizada') || norm(a?.type).includes('nao realizada') || norm(a?.status).includes('não realizada') || norm(a?.status).includes('nao realizada')).length;
      case normalizeText('Reunião Reagendada'):
        return activitiesList.filter((a: any) => norm(a?.type).includes('reagendada') || norm(a?.type).includes('reagenda') || norm(a?.status).includes('reagendada')).length;
      case normalizeText('WhatsApp Enviado'):
        return activitiesList.filter((a: any) => norm(a?.type).includes('whatsapp') || norm(a?.status).includes('whatsapp')).length;
      case normalizeText('Proposta Enviada'):
        return activitiesList.filter((a: any) => norm(a?.type).includes('proposta') || norm(a?.status).includes('proposta')).length;
      case normalizeText('Venda Realizada'):
        return activitiesList.filter((a: any) => norm(a?.type).includes('venda') || norm(a?.status).includes('venda')).length;
      default: {
        // Fallback para compatibilidade com eventuais tipos customizados
        const k = normalizeText(rawLabel);
        return activitiesList.filter((a: any) => normalizeText(a?.type) === k).length;
      }
    }
  };

  const renderTeamConversionCard = (conv: any) => {
    const cardsFiltered = teamSectionCards;
    const activitiesFiltered = teamSectionActivities;

    const getActivityCount = (metricKey: TeamMetricKey) => {
      return getTeamActivityMetricCount(metricKey, activitiesFiltered || []);
    };

    const countA = conv.metricA === 'leads' ? cardsFiltered.length : getActivityCount(conv.metricA);
    const countB = conv.metricB === 'leads' ? cardsFiltered.length : getActivityCount(conv.metricB);
    const result = conversion(countA, countB);

    const labelA = teamMetricOptions.find((o) => o.key === conv.metricA)?.label || 'A';
    const labelB = teamMetricOptions.find((o) => o.key === conv.metricB)?.label || 'B';

    // Modo edição só para admin/master
    if (conv.isEditing && canEditCompanyFilters) {
      return (
        <SortableCard key={conv.id} id={conv.id} disabled>
          <Card className="rounded-none border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-900/10 h-[132px]">
            <CardContent className="p-2 space-y-2">
              <Input
                placeholder="Título da conversão"
                value={conv.name}
                onChange={(e) =>
                  setTeamConversions((prev) => prev.map((c) => (c.id === conv.id ? { ...c, name: e.target.value } : c)))
                }
                className="h-7 text-[10px] rounded-none border-[#d4d4d4] dark:border-gray-700"
              />

              <div className="flex items-center gap-1">
                <Select
                  value={conv.metricA}
                  onValueChange={(v) =>
                    setTeamConversions((prev) => prev.map((c) => (c.id === conv.id ? { ...c, metricA: v as TeamMetricKey } : c)))
                  }
                >
                  <SelectTrigger className="h-7 text-[10px] min-w-[110px] rounded-none border-[#d4d4d4] dark:border-gray-700">
                    <SelectValue placeholder="Métrica A" />
                  </SelectTrigger>
                  <SelectContent className="text-[10px]">
                    {teamMetricOptions.map((o) => (
                      <SelectItem key={o.key} value={o.key}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <span className="text-[10px] text-gray-400">/</span>

                <Select
                  value={conv.metricB}
                  onValueChange={(v) =>
                    setTeamConversions((prev) => prev.map((c) => (c.id === conv.id ? { ...c, metricB: v as TeamMetricKey } : c)))
                  }
                >
                  <SelectTrigger className="h-7 text-[10px] min-w-[110px] rounded-none border-[#d4d4d4] dark:border-gray-700">
                    <SelectValue placeholder="Métrica B" />
                  </SelectTrigger>
                  <SelectContent className="text-[10px]">
                    {teamMetricOptions.map((o) => (
                      <SelectItem key={o.key} value={o.key}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-end gap-1 pt-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-green-600"
                  onClick={() => {
                    const next = teamConversions.map((c) => (c.id === conv.id ? { ...c, isEditing: false } : c));
                    setTeamConversions(next);
                    saveCompanyConversions({ teamConversions: next });
                  }}
                  title="Salvar"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-red-600"
                  onClick={() => removeTeamConversion(conv.id)}
                  title="Remover"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </SortableCard>
      );
    }

    return (
      <SortableCard key={conv.id} id={conv.id} disabled={!allowReorder}>
        <Card className="rounded-none border-gray-200 dark:border-gray-700 dark:bg-[#1b1b1b] relative group h-[132px]">
          <CardContent className="p-4 h-full flex flex-col justify-between">
            <div className="flex flex-col gap-0.5 mb-1">
              <div className="text-[11px] font-medium text-gray-700 dark:text-gray-100 truncate">{conv.name || 'Conversão'}</div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                {labelA} / {labelB}
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 tabular-nums">
                {countA} / {countB}
              </div>
            </div>
            <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{result}%</div>
            {canEditCompanyFilters && (
              <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5"
                  onClick={() => setTeamConversions((prev) => prev.map((c) => (c.id === conv.id ? { ...c, isEditing: true } : c)))}
                  title="Editar"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-5 w-5 text-red-400"
                  onClick={() => removeTeamConversion(conv.id)}
                  title="Remover"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </SortableCard>
    );
  };

  // Filtragem baseada no agente SELECIONADO (não no userRole)
  // "all" = dados gerais da empresa, agente específico = dados apenas daquele agente
  const contactsScoped = useMemo(() => {
    if (selectedAgent && selectedAgent !== 'all' && selectedAgent !== 'ia') {
      const hasResponsible = (contacts as any[]).some((c: any) => c && ('responsible_id' in c));
      if (hasResponsible) {
        return (contacts as any[]).filter((c: any) => String(c.responsible_id || '') === String(selectedAgent));
      }
    }
    return contacts as any[];
  }, [contacts, selectedAgent]);

  const conversationsScoped = useMemo(() => {
    if (selectedAgent && selectedAgent !== 'all' && selectedAgent !== 'ia') {
      return conversations.filter((c) => c.assigned_user_id === selectedAgent);
    }
    return conversations;
  }, [conversations, selectedAgent]);

  const activitiesScoped = useMemo(() => {
    if (selectedAgent && selectedAgent !== 'all' && selectedAgent !== 'ia') {
      return activities.filter((a) => a.responsible_id === selectedAgent);
    }
    return activities;
  }, [activities, selectedAgent]);

  const cardsScoped = useMemo(() => {
    if (selectedAgent && selectedAgent !== 'all' && selectedAgent !== 'ia') {
      return cards.filter((c) => c.responsible_user_id === selectedAgent);
    }
    return cards;
  }, [cards, selectedAgent]);

  // Normalizador local para filtros e métricas de atividades
  const norm = (v?: string | null) => (v || '').toLowerCase().trim();

  const teamSectionRange = useMemo(
    () => getEffectiveRange(teamConvPeriodPreset, teamConvStartDate, teamConvEndDate),
    [teamConvPeriodPreset, teamConvStartDate, teamConvEndDate]
  );

  const teamSectionCards = useMemo(
    () => filterCardsForSection(cardsScoped || [], teamSectionRange.from, teamSectionRange.to, teamConvAgent, teamConvTags, teamConvStatus),
    [cardsScoped, teamSectionRange, teamConvAgent, teamConvTags, teamConvStatus]
  );

  const teamSectionActivities = useMemo(
    () => filterActivitiesForSection(activitiesScoped || [], teamSectionRange.from, teamSectionRange.to, teamConvAgent, teamConvTags),
    [activitiesScoped, teamSectionRange, teamConvAgent, teamConvTags]
  );

  const teamCalls = teamSectionActivities.filter((a: any) => norm(a.type).includes('ligação') || norm(a.type).includes('ligacao') || norm(a.type).includes('chamada'));
  const teamCallsAttended = teamSectionActivities.filter((a: any) => norm(a.type).includes('ligação atendida') || norm(a.type).includes('ligacao atendida'));
  const teamCallsNotAttended = teamSectionActivities.filter((a: any) => norm(a.type).includes('ligação não atendida') || norm(a.type).includes('ligacao nao atendida') || norm(a.type).includes('ligacao não atendida'));
  const teamCallsApproached = teamSectionActivities.filter((a: any) => norm(a.type).includes('ligação abordada') || norm(a.type).includes('ligacao abordada') || norm(a.status).includes('abordada'));
  const teamMessages = teamSectionActivities.filter((a: any) => norm(a.type).includes('mensagem'));
  const teamMeetings = teamSectionActivities.filter((a: any) => norm(a.type).includes('reunião') || norm(a.type).includes('reuniao'));
  const teamMeetingsDone = teamSectionActivities.filter((a: any) => norm(a.type).includes('realizada') || norm(a.status).includes('realizada'));
  const teamProposals = teamSectionActivities.filter((a: any) => norm(a.type).includes('proposta'));
  const teamLeadsWon = teamSectionCards.filter((c: any) => {
    const s = (c.status || '').toLowerCase();
    return s === 'won' || s === 'ganho' || s === 'venda' || s === 'success' || s === 'sucesso';
  }).length;

  // Lista de agentes filtrada: usuário "user" só vê ele mesmo
  const agentsFiltered = useMemo(() => {
    if (userRole === 'user' && user?.id) {
      // Encontra o próprio usuário na lista de agentes (comparando como string para evitar problemas de tipo)
      const selfAgent = agents.find((a) => String(a.id) === String(user.id));
      // Se não encontrar na lista, cria uma entrada com o nome do usuário
      if (selfAgent) {
        return [selfAgent];
      }
      // Fallback: retorna entrada com o ID e nome do usuário atual
      const userName = (user as any)?.name || (user as any)?.email?.split('@')[0] || 'Você';
      return [{ id: user.id, name: userName }];
    }
    return agents;
  }, [agents, userRole, user?.id, user]);

  const leadsReceived = conversationsScoped.length;
  // ✅ Compat: alguns ambientes não possuem `contacts.status`. Se não existir, usar `pipeline_cards.qualification`.
  const hasContactStatus = (contactsScoped as any[]).some((c: any) => c && ('status' in c));
  const leadsQualified = hasContactStatus
    ? (contactsScoped as any[]).filter((c: any) => String(c.status || '').toLowerCase() === 'qualified').length
    : (cardsScoped as any[]).filter((c: any) => String(c.qualification || '').toLowerCase() === 'qualified').length;
  const leadsOffer = hasContactStatus
    ? (contactsScoped as any[]).filter((c: any) => String(c.status || '').toLowerCase() === 'offer').length
    : 0;
  const leadsWon = cardsScoped.filter((c) => {
    const s = (c.status || '').toLowerCase();
    return s === 'won' || s === 'ganho' || s === 'venda' || s === 'success' || s === 'sucesso';
  }).length;
  // ✅ Compat: se não houver `contacts.status`, derivar perdas por status do card (perda/perdido/lost*)
  const isCardLost = (s?: string | null) => {
    const v = String(s || '').toLowerCase();
    return v.startsWith('lost') || v === 'perdido' || v === 'perda' || v === 'lost';
  };
  const leadsLost1 = hasContactStatus
    ? (contactsScoped as any[]).filter((c: any) => String(c.status || '').toLowerCase() === 'lost_offer').length
    : (cardsScoped as any[]).filter((c: any) => isCardLost(c.status)).length;
  const leadsLost2 = hasContactStatus
    ? (contactsScoped as any[]).filter((c: any) => String(c.status || '').toLowerCase() === 'lost_no_offer').length
    : 0;
  const leadsLost3 = hasContactStatus
    ? (contactsScoped as any[]).filter((c: any) => String(c.status || '').toLowerCase() === 'lost_not_fit').length
    : 0;
  const leadsLostTotal = leadsLost1 + leadsLost2 + leadsLost3;

  // Indicadores por funil (múltiplos) — aplicam somente no bloco "Funil – Indicadores"
  const indicatorFunnels = useMemo(() => {
    const nameByTagId = new Map((availableTags || []).map((t: any) => [t.id, t.name]));
    const nameByProductId = new Map((availableProducts || []).map((p: any) => [p.id, p.name]));
    const pipelineIdSet = new Set((pipelines || []).map((p: any) => p.id));
    const getColumnsSet = (pipelineId: string) =>
      new Set((pipelineColumnsMap?.[pipelineId] || []).map((c: any) => c.id));

    const apply = (funnel: any) => {
      let groups = normalizeFunnelGroups(Array.isArray(funnel?.filters) ? funnel.filters : []);
      // Se não há filtros, usa grupo padrão que inclui todos os dados
      if (groups.length === 0) {
        groups = [{
          pipeline: 'all',
          column: 'all',
          team: 'all',
          tags: [],
          products: [],
          dateRange: {},
          status: 'all',
          value: null,
        }];
      }
      const leadMetricsCfg = Array.isArray(funnel?.lead_metrics) ? funnel.lead_metrics : [];
      const metricSets = new Map<string, Set<string>>();
      leadMetricsCfg.forEach((m: any) => metricSets.set(String(m?.id || ''), new Set<string>()));

      const agg = {
        leadsReceived: 0,
        leadsQualified: 0,
        leadsOffer: 0,
        leadsWon: 0,
        leadsByTag: new Map<string, number>(),
        leadsByProduct: new Map<string, number>(),
        salesByProduct: new Map<string, number>(),
        series: new Map<string, { received: number; qualified: number }>(),
      };

      const addToMap = (map: Map<string, number>, name: string, value: number) => {
        map.set(name, (map.get(name) || 0) + value);
      };
      const addSeries = (dateKey: string, incReceived: number, incQualified: number) => {
        const curr = agg.series.get(dateKey) || { received: 0, qualified: 0 };
        curr.received += incReceived;
        curr.qualified += incQualified;
        agg.series.set(dateKey, curr);
      };

      groups.forEach((g: any) => {
        let pipeline = g.pipeline || 'all';
        let column = g.column || 'all';
        const team = g.team || 'all';
        const status = g.status || 'all';
        const tagFilters = Array.isArray(g.tags) ? g.tags : [];
        const productFilters = Array.isArray(g.products) ? g.products : [];
        const dateRange = g.dateRange
          ? {
              from: g.dateRange.from ? new Date(g.dateRange.from).getTime() : undefined,
              to: g.dateRange.to ? new Date(g.dateRange.to).getTime() : undefined,
            }
          : null;
        const valueFilter = g.value;

        if (pipeline !== 'all' && !pipelineIdSet.has(pipeline)) {
          pipeline = 'all';
        }
        if (column !== 'all') {
          if (pipeline === 'all') {
            column = 'all';
          } else {
            const cols = getColumnsSet(pipeline);
            if (!cols.has(column)) column = 'all';
          }
        }

        const withinDate = (iso?: string) => {
          if (!dateRange || (!dateRange.from && !dateRange.to)) return true;
          if (!iso) return false;
          const t = new Date(iso).getTime();
          if (Number.isNaN(t)) return false;
          if (dateRange.from && t < dateRange.from) return false;
          if (dateRange.to && t > dateRange.to) return false;
          return true;
        };

        let cardsF = [...(cardsScoped || [])] as any[];
        if (pipeline !== 'all') cardsF = cardsF.filter((c) => c.pipeline_id === pipeline);
        if (column !== 'all') cardsF = cardsF.filter((c) => c.column_id === column);
        if (team !== 'all') {
          if (team === 'ia') cardsF = cardsF.filter((c) => !c.responsible_user_id);
          else cardsF = cardsF.filter((c) => c.responsible_user_id === team);
        }
        if (status && status !== 'all') {
          cardsF = cardsF.filter((c) => (c.status || '').toLowerCase() === String(status).toLowerCase());
        }
        if (valueFilter?.value) {
          const valueNum = parseFloat(valueFilter.value);
          if (!Number.isNaN(valueNum)) {
            switch (valueFilter.operator) {
              case 'greater':
                cardsF = cardsF.filter((c) => (c.value || 0) > valueNum);
                break;
              case 'less':
                cardsF = cardsF.filter((c) => (c.value || 0) < valueNum);
                break;
              default:
                cardsF = cardsF.filter((c) => c.value === valueNum);
            }
          }
        }
        if (productFilters.length > 0) {
          cardsF = cardsF.filter((c) => (c.products || []).some((p: any) => p?.product_id && productFilters.includes(p.product_id)));
        }

        // data em cards: usa created_at para filtrar quando o lead foi recebido
        if (dateRange && (dateRange.from || dateRange.to)) {
          cardsF = cardsF.filter((c: any) => {
            const iso = c.created_at;
            // se não tiver data, mantém para evitar quedas bruscas
            if (!iso) return true;
            return withinDate(iso);
          });
        }

        if (tagFilters.length > 0) {
          const allowed = new Set<string>();
          (tags || []).forEach((t: any) => {
            if (t?.contact_id && t?.tag_id && tagFilters.includes(t.tag_id)) allowed.add(t.contact_id);
          });
          cardsF = cardsF.filter((c) => c.contact_id && allowed.has(c.contact_id));
        }

        // Base para métricas customizadas: aplica filtros do grupo, mas NÃO trava pipeline/coluna do grupo
        // (a métrica escolhe pipeline/coluna livremente)
        let cardsBase = [...(cardsScoped || [])] as any[];
        if (team !== 'all') {
          if (team === 'ia') cardsBase = cardsBase.filter((c) => !c.responsible_user_id);
          else cardsBase = cardsBase.filter((c) => c.responsible_user_id === team);
        }
        if (status && status !== 'all') {
          cardsBase = cardsBase.filter((c) => (c.status || '').toLowerCase() === String(status).toLowerCase());
        }
        if (valueFilter?.value) {
          const valueNum = parseFloat(valueFilter.value);
          if (!Number.isNaN(valueNum)) {
            switch (valueFilter.operator) {
              case 'greater':
                cardsBase = cardsBase.filter((c) => (c.value || 0) > valueNum);
                break;
              case 'less':
                cardsBase = cardsBase.filter((c) => (c.value || 0) < valueNum);
                break;
              default:
                cardsBase = cardsBase.filter((c) => c.value === valueNum);
            }
          }
        }
        if (productFilters.length > 0) {
          cardsBase = cardsBase.filter((c) => (c.products || []).some((p: any) => p?.product_id && productFilters.includes(p.product_id)));
        }
        if (dateRange && (dateRange.from || dateRange.to)) {
          cardsBase = cardsBase.filter((c: any) => {
            const iso = c.created_at;
            if (!iso) return true;
            return withinDate(iso);
          });
        }
        if (tagFilters.length > 0) {
          const allowed = new Set<string>();
          (tags || []).forEach((t: any) => {
            if (t?.contact_id && t?.tag_id && tagFilters.includes(t.tag_id)) allowed.add(t.contact_id);
          });
          cardsBase = cardsBase.filter((c) => c.contact_id && allowed.has(c.contact_id));
        }

        // Aplicar métricas (pipeline/coluna) e agregar por set (evita double count entre grupos)
        // Usa histórico de movimentação para contar cards que PASSARAM pela coluna no período
        if (leadMetricsCfg.length > 0) {
          // Obter range de datas do grupo para verificação de histórico
          const groupFromDate = g.dateRange?.from ? new Date(g.dateRange.from) : null;
          const groupToDate = g.dateRange?.to ? new Date(g.dateRange.to) : null;
          
          leadMetricsCfg.forEach((m: any) => {
            const id = String(m?.id || '');
            const set = metricSets.get(id);
            if (!set) return;
            let mp = String(m?.pipeline || 'all');
            let mc = String(m?.column || 'all');
            if (mp !== 'all' && !pipelineIdSet.has(mp)) {
              mp = 'all';
            }
            if (mc !== 'all') {
              if (mp === 'all') {
                mc = 'all';
              } else {
                const cols = getColumnsSet(mp);
                if (!cols.has(mc)) mc = 'all';
              }
            }
            let scoped = cardsBase;
            if (mp !== 'all') scoped = scoped.filter((c: any) => c.pipeline_id === mp);
            // Usar histórico para verificar se card passou pela coluna no período
            if (mc !== 'all') scoped = scoped.filter((c: any) => cardPassedThroughColumn(c, mc, groupFromDate, groupToDate));
            scoped.forEach((c: any) => c?.id && set.add(String(c.id)));
          });
        }

        const contactIdsFromCards = new Set<string>(cardsF.map((c) => c.contact_id).filter(Boolean));
        let contactsF = (contactsScoped || []).filter((c: any) => contactIdsFromCards.has(c.id));
        let conversationsF = (conversationsScoped || []).filter((c: any) => contactIdsFromCards.has(c.contact_id));
        let activitiesF = (activitiesScoped || []).filter((a: any) => a.contact_id && contactIdsFromCards.has(a.contact_id));

        if (team && team !== 'all') {
          if (team === 'ia') {
            contactsF = contactsF.filter((c: any) => !c.responsible_id);
            conversationsF = conversationsF.filter((c: any) => !c.assigned_user_id);
            activitiesF = activitiesF.filter((a: any) => !a.responsible_id);
          } else {
            contactsF = contactsF.filter((c: any) => c.responsible_id === team);
            conversationsF = conversationsF.filter((c: any) => c.assigned_user_id === team);
            activitiesF = activitiesF.filter((a: any) => a.responsible_id === team);
          }
        }

        if (dateRange && (dateRange.from || dateRange.to)) {
          contactsF = contactsF.filter((c: any) => withinDate(c.created_at));
          conversationsF = conversationsF.filter((c: any) => withinDate(c.created_at));
          activitiesF = activitiesF.filter((a: any) => withinDate(getActivityDateIso(a)));
        }

        const leadsReceivedF = cardsF.length;
        const leadsQualifiedF = contactsF.filter((c: any) => (c.status || '').toLowerCase() === 'qualified').length;
        const leadsOfferF = contactsF.filter((c: any) => (c.status || '').toLowerCase() === 'offer').length;
        const leadsWonF = cardsF.filter((c: any) => {
          const s = (c.status || '').toLowerCase();
          return s === 'won' || s === 'ganho' || s === 'venda' || s === 'success' || s === 'sucesso';
        }).length;
        const leadsQualifiedCardsF = cardsF.filter((c: any) => String(c.qualification || '').toLowerCase() === 'qualified').length;

        agg.leadsReceived += leadsReceivedF;
        agg.leadsQualified += leadsQualifiedCardsF;
        agg.leadsOffer += leadsOfferF;
        agg.leadsWon += leadsWonF;

        // Séries diárias: baseadas em cards (entrada no funil = created_at) e qualificação do card
        cardsF.forEach((c: any) => {
          const iso = c?.created_at; // Usa created_at para "Recebidos" (quando o lead entrou)
          if (!iso) return;
          const key = format(new Date(iso), 'yyyy-MM-dd');
          const isQualified = String(c.qualification || '').toLowerCase() === 'qualified';
          addSeries(key, 1, isQualified ? 1 : 0);
        });

        const byTag = new Map<string, number>();
        (tags || []).forEach((t: any) => {
          if (!t?.contact_id || !t?.tag_id) return;
          if (!contactIdsFromCards.has(t.contact_id)) return;
          if (tagFilters.length > 0 && !tagFilters.includes(t.tag_id)) return;
          const name = nameByTagId.get(t.tag_id) || t.tag_id || 'Etiqueta';
          byTag.set(name, (byTag.get(name) || 0) + 1);
        });
        byTag.forEach((v, k) => addToMap(agg.leadsByTag, k, v));

        const byProduct = new Map<string, number>();
        cardsF.forEach((c: any) => {
          if (!c?.contact_id) return;
          (c.products || []).forEach((p: any) => {
            const pid = p?.product_id;
            if (!pid) return;
            if (productFilters.length > 0 && !productFilters.includes(pid)) return;
            const name = nameByProductId.get(pid) || p?.product_name_snapshot || pid || 'Produto';
            byProduct.set(name, (byProduct.get(name) || 0) + 1);
          });
        });
        byProduct.forEach((v, k) => addToMap(agg.leadsByProduct, k, v));

        // Vendas por produto (somente cards ganhos)
        const bySalesProduct = new Map<string, number>();
        cardsF.forEach((c: any) => {
          const s = (c?.status || '').toLowerCase();
          const isWon = s === 'won' || s === 'ganho' || s === 'venda' || s === 'success' || s === 'sucesso';
          if (!isWon) return;
          (c.products || []).forEach((p: any) => {
            const pid = p?.product_id;
            if (!pid) return;
            if (productFilters.length > 0 && !productFilters.includes(pid)) return;
            const name = nameByProductId.get(pid) || p?.product_name_snapshot || pid || 'Produto';
            bySalesProduct.set(name, (bySalesProduct.get(name) || 0) + 1);
          });
        });
        bySalesProduct.forEach((v, k) => addToMap(agg.salesByProduct, k, v));
      });

      return {
        id: funnel.id,
        name: funnel.name,
        leadsReceived: agg.leadsReceived,
        leadsQualified: agg.leadsQualified,
        leadsOffer: agg.leadsOffer,
        leadsWon: agg.leadsWon,
        lead_metrics: leadMetricsCfg.map((m: any, idx: number) => {
          const id = String(m?.id || `metric-${idx + 1}`);
          const value = metricSets.get(id)?.size || 0;
          return { ...m, id, value };
        }),
        leadsByTag: Array.from(agg.leadsByTag.entries()).map(([name, value]) => ({ name, value })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value),
        leadsByProduct: Array.from(agg.leadsByProduct.entries()).map(([name, value]) => ({ name, value })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value),
        salesByProduct: Array.from(agg.salesByProduct.entries()).map(([name, value]) => ({ name, value })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value),
        leadsSeries: Array.from(agg.series.entries())
          .map(([date, obj]) => ({ date, received: obj.received, qualified: obj.qualified }))
          .sort((a, b) => a.date.localeCompare(b.date)),
      };
    };

    return (draftFunnels || []).map(apply);
  }, [availableProducts, availableTags, activities, cards, contacts, conversations, draftFunnels, tags, cardsScoped]);

  // ✅ Gráfico global usa TODOS os cards (filtrados pelo período global), não pelos filtros individuais dos funis
  const leadsSeriesGlobal = useMemo(() => {
    const m = new Map<string, { received: number; qualified: number }>();
    
    // Usa cardsScoped (filtrado por agente global) com filtro de data global
    const globalRangeFrom = startDate ? startOfDay(startDate).getTime() : null;
    const globalRangeTo = endDate ? endOfDay(endDate).getTime() : null;
    
    (cardsScoped || []).forEach((c: any) => {
      // Para "Recebidos": usa created_at (quando o lead entrou no sistema)
      const createdIso = c?.created_at;
      if (!createdIso) return;
      
      const createdTime = new Date(createdIso).getTime();
      if (Number.isNaN(createdTime)) return;
      
      // Aplica filtro de data global baseado em created_at
      if (globalRangeFrom && createdTime < globalRangeFrom) return;
      if (globalRangeTo && createdTime > globalRangeTo) return;
      
      const key = format(new Date(createdIso), 'yyyy-MM-dd');
      const curr = m.get(key) || { received: 0, qualified: 0 };
      curr.received += 1;
      
      // Para "Qualificados": conta se o card está qualificado
      if (String(c.qualification || '').toLowerCase() === 'qualified') {
        curr.qualified += 1;
      }
      m.set(key, curr);
    });
    
    return Array.from(m.entries())
      .map(([date, obj]) => ({ date, received: obj.received, qualified: obj.qualified }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [cardsScoped, startDate, endDate]);

  // Garante que o gráfico sempre inclua "hoje" (mesmo com 0) e evita bug de timezone ao renderizar yyyy-MM-dd
  const leadsSeriesGlobalForChart = useMemo(() => {
    try {
      const now = new Date();
      // O gráfico segue o range global, mas se algum funil exigir mais dados, o gráfico se expande para mostrar tudo o que foi buscado.
      let rangeFrom = (startDate && !Number.isNaN(startDate.getTime())) ? startOfDay(startDate) : startOfDay(subDays(now, 29));
      let rangeTo = (endDate && !Number.isNaN(endDate.getTime())) ? endOfDay(endDate) : endOfDay(now);

      if (requiredDataRangeFromFunnels.from && (!rangeFrom || requiredDataRangeFromFunnels.from < rangeFrom)) {
        rangeFrom = startOfDay(requiredDataRangeFromFunnels.from);
      }
      if (requiredDataRangeFromFunnels.to && (!rangeTo || requiredDataRangeFromFunnels.to > rangeTo)) {
        rangeTo = endOfDay(requiredDataRangeFromFunnels.to);
      }

      if (rangeFrom > rangeTo) {
        return [];
      }

      const seriesData = leadsSeriesGlobal || [];
      const byDate = new Map<string, { received: number; qualified: number }>(
        seriesData.map((p: any) => [String(p.date), { received: Number(p.received || 0), qualified: Number(p.qualified || 0) }])
      );

      return eachDayOfInterval({ start: rangeFrom, end: rangeTo }).map((d) => {
        const key = format(d, 'yyyy-MM-dd');
        const v = byDate.get(key);
        return { date: key, received: v?.received ?? 0, qualified: v?.qualified ?? 0 };
      });
    } catch (e) {
      return [];
    }
  }, [leadsSeriesGlobal, startDate, endDate, requiredDataRangeFromFunnels]);

  const leadsByTag = useMemo(() => {
    const nameById = new Map((availableTags || []).map((t) => [t.id, t.name]));
    const map = new Map<string, number>();

    // 1. Processa os contatos únicos por etiqueta no período filtrado
    if (tags && tags.length > 0) {
      const tagContacts = new Map<string, Set<string>>();
      
      tags.forEach((t) => {
        const contactId = t.contact_id;
        const tagId = t.tag_id;
        if (!contactId || !tagId) return;

        const includeTag = selectedTags.length === 0 || selectedTags.includes(tagId);
        if (!includeTag) return;

        if (!tagContacts.has(tagId)) tagContacts.set(tagId, new Set());
        tagContacts.get(tagId)?.add(contactId);
      });

      tagContacts.forEach((contacts, tagId) => {
        const name = nameById.get(tagId) || tagId || 'Etiqueta';
        map.set(name, contacts.size);
      });
    }

    // 2. Complementa com o contact_count real (all-time) se o filtro de período não trouxe dados para aquela etiqueta
    if (availableTags && availableTags.length > 0) {
      availableTags.forEach((t) => {
        const includeTag = selectedTags.length === 0 || selectedTags.includes(t.id);
        if (!includeTag) return;

        const existing = map.get(t.name) || 0;
        const aggregated = typeof t.contact_count === 'number' ? t.contact_count : 0;

        if (existing === 0 && aggregated > 0) {
          map.set(t.name, aggregated);
        }
      });
    }

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [tags, availableTags, selectedTags]);

  const leadsByProduct = useMemo(() => {
    const nameById = new Map((availableProducts || []).map((p) => [p.id, p.name]));
    const map = new Map<string, number>();
    const snapshotNameById = new Map<string, string>();

    // 1. Processa os contatos únicos por produto no período filtrado
    if (cards && cards.length > 0) {
      const productContacts = new Map<string, Set<string>>();
      
      cards.forEach((c) => {
        const contactId = c.contact_id;
        if (!contactId) return;

        (c.products || []).forEach((p) => {
          const productId = p.product_id;
          if (!productId) return;

          const snap = p.product_name_snapshot;
          if (snap && !snapshotNameById.has(productId)) snapshotNameById.set(productId, snap);
          
          if (!productContacts.has(productId)) productContacts.set(productId, new Set());
          productContacts.get(productId)?.add(contactId);
        });
      });

      productContacts.forEach((contacts, productId) => {
        const name = nameById.get(productId) || snapshotNameById.get(productId) || productId || 'Produto';
        map.set(name, contacts.size);
      });
    }

    // 2. Complementa com o contact_count real (all-time) se o filtro de período não trouxe dados
    // (Ou se o mapa ainda está vazio)
    if (availableProducts && availableProducts.length > 0) {
      availableProducts.forEach((p) => {
        const name = p.name || 'Produto';
        const existing = map.get(name) || 0;
        const aggregated = typeof p.contact_count === 'number' ? p.contact_count : 0;

        // Se não temos dados do período para este produto, usamos o acumulado real
        if (existing === 0 && aggregated > 0) {
          map.set(name, aggregated);
        }
      });
    }

    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [cards, availableProducts]);

  // Atividades: tudo do Ranking de Trabalho vem de public.activities (como você explicou)
  const calls = activities.filter((a) => norm(a.type).includes('ligação') || norm(a.type).includes('ligacao') || norm(a.type).includes('chamada'));
  const callsAttended = activities.filter((a) => norm(a.type).includes('ligação atendida') || norm(a.type).includes('ligacao atendida'));
  const callsNotAttended = activities.filter((a) => norm(a.type).includes('ligação não atendida') || norm(a.type).includes('ligacao nao atendida') || norm(a.type).includes('ligacao não atendida'));
  const callsApproached = activities.filter((a) => norm(a.type).includes('ligação abordada') || norm(a.type).includes('ligacao abordada') || norm(a.status).includes('abordada'));
  const callsFollowUp = activities.filter((a) => norm(a.type).includes('follow') || norm(a.status).includes('follow'));
  const messages = activities.filter((a) => norm(a.type).includes('mensagem'));
  const whatsappSent = activities.filter((a) => norm(a.type).includes('whatsapp') || norm(a.status).includes('whatsapp'));
  const meetings = activities.filter((a) => norm(a.type).includes('reunião') || norm(a.type).includes('reuniao'));
  const meetingsDone = activities.filter((a) => norm(a.type).includes('realizada') || norm(a.status).includes('realizada'));
  const meetingsNotDone = activities.filter((a) => norm(a.type).includes('não realizada') || norm(a.type).includes('nao realizada') || norm(a.status).includes('não realizada') || norm(a.status).includes('nao realizada'));
  const meetingsRescheduled = activities.filter((a) => norm(a.type).includes('reagendada') || norm(a.type).includes('reagenda') || norm(a.status).includes('reagendada'));
  const proposals = activities.filter((a) => norm(a.type).includes('proposta'));
  const activeConversations = messages.reduce((set, m) => {
    if (m.contact_id) set.add(m.contact_id);
    return set;
  }, new Set<string>()).size;

  const conversion = (num: number, den: number) => (den > 0 ? Number(((num / den) * 100).toFixed(1)) : 0);

  // Opções para conversões dinâmicas de Equipe – Conversão
  const teamMetricOptions = useMemo(() => {
    const activityLabels = [
      'Mensagem',
      'Ligação Não Atendida',
      'Ligação Atendida',
      'Ligação Abordada',
      'Ligação Agendada',
      'Ligação de Follow up',
      'Reunião Agendada',
      'Reunião Realizada',
      'Reunião Não Realizada',
      'Reunião Reagendada',
      'WhatsApp Enviado',
      'Proposta Enviada',
      'Venda Realizada',
    ];
    return [
      { key: 'leads' as TeamMetricKey, label: 'Leads' },
      ...activityLabels.map((l) => ({ key: `activity:${l}` as TeamMetricKey, label: l })),
    ];
  }, []);

  const teamMetricCounts = useMemo(() => {
    const counts = new Map<TeamMetricKey, number>();
    // Leads = cards no recorte atual
    counts.set('leads', (cardsScoped || []).length);

    // Atividades por type (normalizado)
    const byType = new Map<string, number>();
    (activitiesScoped || []).forEach((a: any) => {
      const key = normalizeText(a?.type);
      if (!key) return;
      byType.set(key, (byType.get(key) || 0) + 1);
    });

    teamMetricOptions.forEach((opt) => {
      if (opt.key === 'leads') return;
      const rawLabel = opt.key.replace(/^activity:/, '');
      const k = normalizeText(rawLabel);
      counts.set(opt.key, byType.get(k) || 0);
    });

    return counts;
  }, [activitiesScoped, cardsScoped, teamMetricOptions]);

  // Agrupamentos por responsável para rankings
  const agentMap = useMemo(() => {
    const map = new Map<string, { name: string }>();
    agents.forEach((a) => map.set(a.id, { name: a.name }));
    return map;
  }, [agents]);

  const teamAggregates = useMemo<any[]>(() => {
    const agg: Record<string, any> = {};
    const agentIdSet = new Set((agents || []).map((a) => a.id));
    
    // 1. Inicializar com TODOS os agentes do workspace
    agents.forEach((a) => {
      agg[a.id] = {
        id: a.id,
        name: a.name,
        leads: 0,
        calls: 0,
        callsAttended: 0,
        callsNotAttended: 0,
        callsApproached: 0,
        callsFollowUp: 0,
        messages: 0,
        whatsappSent: 0,
        meetings: 0,
        meetingsDone: 0,
        meetingsNotDone: 0,
        meetingsRescheduled: 0,
        proposals: 0,
        sales: 0,
        revenue: 0,
        products: 0,
      };
    });

    // Entrada para "Agente IA" se houver dados atribuídos a IA (null)
    const ensure = (id: string | null | undefined) => {
      // null/undefined = Agente IA (mantém no ranking se houver dados)
      if (!id) {
        const key = 'ia';
        if (!agg[key]) {
          agg[key] = {
            id: key,
            name: 'Agente IA',
            leads: 0,
            calls: 0,
            callsAttended: 0,
            callsNotAttended: 0,
            callsApproached: 0,
            callsFollowUp: 0,
            messages: 0,
            whatsappSent: 0,
            meetings: 0,
            meetingsDone: 0,
            meetingsNotDone: 0,
            meetingsRescheduled: 0,
            proposals: 0,
            sales: 0,
            revenue: 0,
            products: 0,
          };
        }
        return agg[key];
      }

      // Se não for um usuário/agente do workspace, não entra no ranking
      if (!agentIdSet.has(id)) return null;

      const key = id;
      if (!agg[key]) {
        agg[key] = {
          id: key,
          name: agentMap.get(key)?.name || 'Usuário',
          leads: 0,
          calls: 0,
          callsAttended: 0,
          callsNotAttended: 0,
          callsApproached: 0,
          callsFollowUp: 0,
          messages: 0,
          whatsappSent: 0,
          meetings: 0,
          meetingsDone: 0,
          meetingsNotDone: 0,
          meetingsRescheduled: 0,
          proposals: 0,
          sales: 0,
          revenue: 0,
          products: 0,
        };
      }
      return agg[key];
    };

    contacts.forEach((c) => {
      const t = ensure(c.responsible_id);
      if (!t) return;
      t.leads += 1;
    });

    activities.forEach((act) => {
      const target = ensure(act.responsible_id);
      if (!target) return;
      const t = norm(act.type);

      // Mensagens
      if (t.includes('mensagem')) {
        target.messages += 1;
      }

      // Ligações
      if (t.includes('ligação') || t.includes('ligacao') || t.includes('chamada')) {
        target.calls += 1;
        if (t.includes('atendida')) target.callsAttended += 1;
        if (t.includes('não atendida') || t.includes('nao atendida')) target.callsNotAttended += 1;
        if (t.includes('abordada') || norm(act.status).includes('abordada')) target.callsApproached += 1;
        if (t.includes('follow') || norm(act.status).includes('follow')) target.callsFollowUp += 1;
      }

      // WhatsApp (atividade)
      if (t.includes('whatsapp') || norm(act.status).includes('whatsapp')) {
        target.whatsappSent += 1;
      }

      // Reuniões
      if (t.includes('reunião') || t.includes('reuniao')) {
        target.meetings += 1;
        if (t.includes('realizada') || norm(act.status).includes('realizada')) target.meetingsDone += 1;
        if (t.includes('não realizada') || t.includes('nao realizada') || norm(act.status).includes('não realizada') || norm(act.status).includes('nao realizada')) target.meetingsNotDone += 1;
        if (t.includes('reagendada') || t.includes('reagenda') || norm(act.status).includes('reagendada')) target.meetingsRescheduled += 1;
      }

      // Propostas (atividades)
      if (t.includes('proposta')) {
        target.proposals += 1;
      }
    });

    // Propostas provenientes da coleção dedicada (compatibilidade)
    proposals.forEach((p) => {
      const t = ensure(p.responsible_id);
      if (!t) return;
      t.proposals += 1;
    });

    const parseNumber = (v: any) => {
      if (v === null || v === undefined) return 0;
      if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
      const parsed = Number(String(v).replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : 0;
    };

    cardsScoped.forEach((c) => {
      const s = (c.status || '').toLowerCase();
      const isWon = s === 'won' || s === 'ganho' || s === 'venda' || s === 'success' || s === 'sucesso';
      if (!isWon) return;

      const cardProducts = Array.isArray(c.products) ? c.products : [];
      const hasProducts = cardProducts.length > 0;
      if (!hasProducts) return; // considerar somente cartões ganhos com produto vinculado

      const target = ensure(c.responsible_user_id);
      if (!target) return;

      const revenueFromProducts = cardProducts.reduce((sum, pcp: any) => {
        const total = parseNumber(pcp.total_value ?? pcp.total ?? pcp.total_price);
        const unit = parseNumber(
          pcp.unit_value ??
          pcp.price ??
          pcp.value ??
          pcp.amount ??
          pcp.product_value ??
          pcp.product?.value ??
          pcp.unitPrice ??
          pcp.unit_price
        );
        const qty = parseNumber(pcp.quantity || 1);
        const base = total > 0 ? total : unit * (qty || 1);
        return sum + base;
      }, 0);

      // Se produtos não carregarem valor, use fallback do card.value
      const revenue = revenueFromProducts > 0 ? revenueFromProducts : Number(c.value || 0);

      const totalProductsQuantity = cardProducts.reduce((sum, pcp: any) => sum + Number(pcp.quantity || 1), 0);

      target.sales += 1;
      target.revenue += revenue;
      target.products += totalProductsQuantity;
    });

    return Object.values(agg);
  }, [agents, contacts, activities, proposals, cards]);

  const rankingVendas = useMemo<any[]>(() => {
    const { from, to } = getEffectiveRange(salesRankingPreset, salesRankingStartDate, salesRankingEndDate);

    const parseNumber = (v: any) => {
      if (v === null || v === undefined) return 0;
      if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
      const parsed = Number(String(v).replace(',', '.'));
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const agentIdSet = new Set((agents || []).map((a) => a.id));
    const agg: Record<string, any> = {};

    // Inicializa todos os agentes do workspace
    (agents || []).forEach((a) => {
      agg[a.id] = { id: a.id, name: a.name, revenue: 0, sales: 0, products: 0 };
    });

    const ensure = (id: string | null | undefined) => {
      if (!id) {
        const key = 'ia';
        if (!agg[key]) agg[key] = { id: key, name: 'Agente IA', revenue: 0, sales: 0, products: 0 };
        return agg[key];
      }
      if (!agentIdSet.has(id)) return null;
      if (!agg[id]) agg[id] = { id, name: agentMap.get(id)?.name || 'Usuário', revenue: 0, sales: 0, products: 0 };
      return agg[id];
    };

    (salesRankingRows || []).forEach((row: any) => {
      if (!withinRange(row?.card_date, from, to)) return;

      const target = ensure(row?.responsible_user_id || null);
      if (!target) return;

      target.sales += 1;
      target.revenue += parseNumber(row?.revenue || 0);
      target.products += parseNumber(row?.products_qty || 0);
    });

    const list = Object.values(agg)
      .map((row: any) => ({
        ...row,
        pa: row.sales > 0 ? Number(((row.products || 0) / row.sales).toFixed(2)) : 0,
        ticket: row.sales > 0 ? Number(((row.revenue || 0) / row.sales).toFixed(2)) : 0,
      }))
      .sort((a: any, b: any) => (b.revenue || 0) - (a.revenue || 0));

    // Filtra usuários visíveis (se configurado pelo admin/master)
    if (salesRankingUsers && salesRankingUsers.length > 0) {
      return list.filter((row: any) => salesRankingUsers.includes(row.id));
    }

    return list;
  }, [
    agents,
    agentMap,
    salesRankingRows,
    salesRankingPreset,
    salesRankingStartDate,
    salesRankingEndDate,
    salesRankingUsers,
  ]);

  const rankingTrabalho = useMemo<any[]>(() => {
    // Base: todos os agentes do workspace com contagem 0 (para aparecerem mesmo sem atividades)
    const agg: Record<string, any> = {};
    const agentIdSet = new Set((agents || []).map((a) => a.id));
    agents.forEach((a) => {
      agg[a.id] = {
        id: a.id,
        name: a.name,
        mensagem: 0,
        ligacao_nao_atendida: 0,
        ligacao_atendida: 0,
        ligacao_abordada: 0,
        ligacao_agendada: 0,
        ligacao_follow_up: 0,
        reuniao_agendada: 0,
        reuniao_realizada: 0,
        reuniao_nao_realizada: 0,
        reuniao_reagendada: 0,
        whatsapp_enviado: 0,
        proposta_enviada: 0,
        venda_realizada: 0,
      };
    });

    const ensure = (id: string | null | undefined) => {
      // null/undefined = Agente IA (mantém se houver dados)
      if (!id) {
        const key = 'ia';
        if (!agg[key]) {
          agg[key] = {
            id: key,
            name: 'Agente IA',
            mensagem: 0,
            ligacao_nao_atendida: 0,
            ligacao_atendida: 0,
            ligacao_abordada: 0,
            ligacao_agendada: 0,
            ligacao_follow_up: 0,
            reuniao_agendada: 0,
            reuniao_realizada: 0,
            reuniao_nao_realizada: 0,
            reuniao_reagendada: 0,
            whatsapp_enviado: 0,
            proposta_enviada: 0,
            venda_realizada: 0,
          };
        }
        return agg[key];
      }
      if (!agentIdSet.has(id)) return null;
      const key = id;
      if (!agg[key]) {
        agg[key] = {
          id: key,
          name: agentMap.get(key)?.name || 'Usuário',
          mensagem: 0,
          ligacao_nao_atendida: 0,
          ligacao_atendida: 0,
          ligacao_abordada: 0,
          ligacao_agendada: 0,
          ligacao_follow_up: 0,
          reuniao_agendada: 0,
          reuniao_realizada: 0,
          reuniao_nao_realizada: 0,
          reuniao_reagendada: 0,
          whatsapp_enviado: 0,
          proposta_enviada: 0,
          venda_realizada: 0,
        };
      }
      return agg[key];
    };

    // Usar sempre os dados da RPC (workRankingData) que já está filtrado pelo período específico
    (workRankingData || []).forEach((r) => {
      const t = ensure((r as any).responsible_id);
      if (!t) return;
      t.mensagem = Number((r as any).mensagem || 0);
      t.ligacao_nao_atendida = Number((r as any).ligacao_nao_atendida || 0);
      t.ligacao_atendida = Number((r as any).ligacao_atendida || 0);
      t.ligacao_abordada = Number((r as any).ligacao_abordada || 0);
      t.ligacao_agendada = Number((r as any).ligacao_agendada || 0);
      t.ligacao_follow_up = Number((r as any).ligacao_follow_up || 0);
      t.reuniao_agendada = Number((r as any).reuniao_agendada || 0);
      t.reuniao_realizada = Number((r as any).reuniao_realizada || 0);
      t.reuniao_nao_realizada = Number((r as any).reuniao_nao_realizada || 0);
      t.reuniao_reagendada = Number((r as any).reuniao_reagendada || 0);
      t.whatsapp_enviado = Number((r as any).whatsapp_enviado || 0);
      t.proposta_enviada = Number((r as any).proposta_enviada || 0);
      t.venda_realizada = Number((r as any).venda_realizada || 0);
    });

    const list = Object.values(agg).map((row: any) => {
      const total =
        (row.mensagem || 0) +
        (row.ligacao_nao_atendida || 0) +
        (row.ligacao_atendida || 0) +
        (row.ligacao_abordada || 0) +
        (row.ligacao_agendada || 0) +
        (row.ligacao_follow_up || 0) +
        (row.reuniao_agendada || 0) +
        (row.reuniao_realizada || 0) +
        (row.reuniao_nao_realizada || 0) +
        (row.reuniao_reagendada || 0) +
        (row.whatsapp_enviado || 0) +
        (row.proposta_enviada || 0) +
        (row.venda_realizada || 0);
      return { ...row, total };
    });

    const sorted = list.sort((a: any, b: any) => (b.total || 0) - (a.total || 0));

    // Filtra usuários visíveis (se configurado pelo admin/master)
    if (workRankingUsers && workRankingUsers.length > 0) {
      return sorted.filter((row: any) => workRankingUsers.includes(row.id));
    }

    return sorted;
  }, [
    agents,
    agentMap,
    workRankingData,
    workRankingUsers,
  ]);

  const rankingVendasTotals = useMemo(() => {
    const revenue = (rankingVendas || []).reduce((sum: number, r: any) => sum + Number(r?.revenue || 0), 0);
    const sales = (rankingVendas || []).reduce((sum: number, r: any) => sum + Number(r?.sales || 0), 0);
    const products = (rankingVendas || []).reduce((sum: number, r: any) => sum + Number(r?.products || 0), 0);
    const pa = sales > 0 ? Number((products / sales).toFixed(2)) : 0;
    const ticket = sales > 0 ? Number((revenue / sales).toFixed(2)) : 0;
    return { revenue, sales, products, pa, ticket };
  }, [rankingVendas]);

  const rankingTrabalhoTotals = useMemo(() => {
    const sum = (k: string) => (rankingTrabalho || []).reduce((acc: number, r: any) => acc + Number(r?.[k] || 0), 0);
    const totals = {
      mensagem: sum('mensagem'),
      ligacao_nao_atendida: sum('ligacao_nao_atendida'),
      ligacao_atendida: sum('ligacao_atendida'),
      ligacao_abordada: sum('ligacao_abordada'),
      ligacao_agendada: sum('ligacao_agendada'),
      ligacao_follow_up: sum('ligacao_follow_up'),
      reuniao_agendada: sum('reuniao_agendada'),
      reuniao_realizada: sum('reuniao_realizada'),
      reuniao_nao_realizada: sum('reuniao_nao_realizada'),
      reuniao_reagendada: sum('reuniao_reagendada'),
      whatsapp_enviado: sum('whatsapp_enviado'),
      proposta_enviada: sum('proposta_enviada'),
      venda_realizada: sum('venda_realizada'),
    };
    const total =
      totals.mensagem +
      totals.ligacao_nao_atendida +
      totals.ligacao_atendida +
      totals.ligacao_abordada +
      totals.ligacao_agendada +
      totals.ligacao_follow_up +
      totals.reuniao_agendada +
      totals.reuniao_realizada +
      totals.reuniao_nao_realizada +
      totals.reuniao_reagendada +
      totals.whatsapp_enviado +
      totals.proposta_enviada +
      totals.venda_realizada;
    return { ...totals, total };
  }, [rankingTrabalho]);

  const hasDateRange = !!(startDate && endDate);
  const periodLabel = !hasDateRange || !periodPreset
    ? 'Todos os períodos'
    : periodPreset !== 'custom'
      ? (
        {
          all: 'Todos os períodos',
          today: 'Hoje',
          last7: 'Últimos 7 dias',
          last30: 'Últimos 30 dias',
        }[periodPreset] || 'Personalizado'
      )
      : `${startDate ? format(startDate, "dd/MM/yyyy", { locale: ptBR }) : ''} - ${endDate ? format(endDate, "dd/MM/yyyy", { locale: ptBR }) : ''}`;

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <div className="flex flex-col h-full bg-white border border-gray-300 m-2 shadow-sm font-sans text-xs dark:bg-[#0e0e0e] dark:border-gray-700 dark:text-gray-100">
        {/* Header */}
        <div className="flex flex-col border-b border-gray-300 bg-[#f8f9fa] dark:border-gray-700 dark:bg-[#141414]">
          <div className="flex items-center justify-between px-4 pt-3 pb-2 h-auto" style={{ fontSize: '15px' }}>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 dark:text-gray-100" style={{ fontSize: '1.5rem' }}>Relatórios</span>
            </div>
            {/* Seletor de empresa para master-dashboard */}
            {workspaces && workspaces.length > 0 && (
              <div className="flex items-center gap-2">
                <Select
                  value={selectedWorkspaceId || 'all'}
                  onValueChange={(value) => {
                    const nextId = value === 'all' ? '' : value;
                    setSelectedWorkspaceId(nextId);
                    if (value === 'all') {
                      setSelectedWorkspace(null);
                      return;
                    }
                    const nextWorkspace = workspaces.find((w) => w.workspace_id === value) || null;
                    setSelectedWorkspace(nextWorkspace);
                  }}
                >
                  <SelectTrigger className="w-[250px] h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 !bg-white dark:!bg-[#2d2d2d] !text-gray-900 dark:!text-gray-200">
                    <SelectValue placeholder="Selecione a empresa" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d]">
                    <SelectItem value="all" className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700">
                      Todas as empresas
                    </SelectItem>
                    {workspaces.map((workspace) => (
                      <SelectItem
                        key={workspace.workspace_id}
                        value={workspace.workspace_id}
                        className="text-gray-900 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        {workspace.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 px-4 pb-3">
            <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-100">Filtros avançados</span>
            {canEditCompanyFilters && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-3 text-[10px] rounded-none gap-1.5"
                onClick={saveCompanyFiltersPreset}
                disabled={loadingCompanyFilters}
                title="Salvar filtros atuais como padrão para toda a empresa"
              >
                {loadingCompanyFilters ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Save className="h-3 w-3" />
                )}
                Salvar para empresa
              </Button>
            )}
          </div>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden bg-[#e6e6e6] dark:bg-[#050505] relative">
          <div className="block w-full align-middle bg-white dark:bg-[#111111]">
            <div className="p-4 space-y-4">
              {!user?.id && (
                <div className="border border-orange-300 bg-orange-50 text-orange-800 px-3 py-2 text-xs dark:border-orange-800 dark:bg-[#2a1d00] dark:text-orange-200">
                  Sessão do usuário não carregada. Faça login novamente (ou recarregue a página após logar) para carregar os indicadores.
                </div>
              )}
             
              {/* Área Principal */}
              <div className="flex flex-col overflow-hidden border border-[#d4d4d4] dark:border-gray-800 bg-white dark:bg-[#0f0f0f] shadow-sm p-4 space-y-6 min-h-0">
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-300">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando dados...
          </div>
        )}

        {/* Funil – Indicadores */}
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Filter className="h-4 w-4" />
            Funil – Indicadores
          </div>

          {/* Builder: múltiplos funis */}
          <div className="space-y-3">
            {draftFunnels.map((f: any, idx: number) => (
              <div
                key={f.id}
                className="border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#0f0f0f] px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <QueryBuilderSidebar
                    layout="inline"
                    className="w-full"
                    pipelines={pipelines || []}
                    tags={availableTags || []}
                    products={availableProducts || []}
                    agents={agentsFiltered || []}
                    showAIAgent={userRole !== 'user'}
                    selectedWorkspaceId={selectedWorkspaceId || workspaces?.[0]?.workspace_id || ''}
                    onFiltersChange={(filters) => {
                      setDraftFunnels((prev: any[]) => {
                        const current = prev.find((x) => x.id === f.id);
                        // Comparar SEMPRE em formato canonizado (ISO + início/fim do dia),
                        // para evitar loop de re-hidratação onde o mesmo range fica "trocando" por serialização/timezone.
                        const currentCanon = sanitizeGroupsForPersist(Array.isArray(current?.filters) ? current.filters : []);
                        const incomingCanon = sanitizeGroupsForPersist(filters || []);
                        if (serializeGroups(currentCanon) === serializeGroups(incomingCanon)) return prev;

                        const next = prev.map((x) => (x.id === f.id ? { ...x, filters: incomingCanon } : x));
                        return next;
                      });
                    }}
                    initialFilters={f.filters}
                    rehydrateNonce={rehydrateNonce}
                    showHeader={false}
                    disabled={false}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Gráfico global (agora acima dos cards de indicadores) */}
          <Card className="rounded-none border-gray-200 dark:border-gray-700 dark:bg-[#1b1b1b]">
              <CardHeader className="py-2 px-3">
                <CardTitle className="text-xs text-gray-700 dark:text-gray-100">
                  Evolução de Leads — Geral
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={leadsSeriesGlobalForChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1f2937' : '#e5e7eb'} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: isDark ? '#e5e7eb' : '#4b5563' }}
                        stroke={isDark ? '#e5e7eb' : '#4b5563'}
                        tickFormatter={(val: string) => format(parseISO(val), 'dd/MM')}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: isDark ? '#e5e7eb' : '#4b5563' }}
                        stroke={isDark ? '#e5e7eb' : '#4b5563'}
                        allowDecimals={false}
                      />
                      <ReTooltip
                        formatter={(value: number, name: string) => [value, (name === 'received' || name === 'Recebidos') ? 'Recebidos' : 'Qualificados']}
                        labelFormatter={(label: string) => `Data: ${format(parseISO(label), 'dd/MM/yyyy')}`}
                        contentStyle={{
                          backgroundColor: isDark ? '#1b1b1b' : '#fff',
                          borderColor: isDark ? '#374151' : '#d4d4d4',
                          color: isDark ? '#fff' : '#000',
                          fontSize: '10px',
                          borderRadius: '0px',
                        }}
                        itemStyle={{ color: isDark ? '#e2e8f0' : '#374151' }}
                      />
                      <Legend
                        verticalAlign="top"
                        height={24}
                        iconType="circle"
                        wrapperStyle={{
                          fontSize: '10px',
                          color: isDark ? '#ffffff' : '#4b5563',
                          paddingBottom: '4px',
                        }}
                        formatter={(value: string) => (value === 'received' || value === 'Recebidos' ? 'Recebidos' : 'Qualificados')}
                      />
                      <Line type="monotone" dataKey="received" name="Recebidos" stroke="#3B82F6" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="qualified" name="Qualificados" stroke="#F59E0B" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

          {/* Render: indicadores por funil */}
          <div className="space-y-3">
            {indicatorFunnels.map((f: any) => (
              <div key={f.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-stretch">
                <Card className="rounded-none border-gray-200 dark:border-gray-700 md:col-span-4 h-full flex flex-col dark:bg-[#1b1b1b] group relative">
                  <CardHeader className="py-1.5 px-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-xs text-gray-700 dark:text-gray-100">
                        Leads
                      </CardTitle>
                      {canEditIndicatorFunnels && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-7 px-2 rounded-none text-[10px] border border-transparent hover:border-gray-200 dark:hover:border-gray-700",
                            "opacity-0 group-hover:opacity-100 transition-opacity",
                            editingMetricsFunnelId === f.id && "opacity-100"
                          )}
                          onClick={() => setEditingMetricsFunnelId((cur) => (cur === f.id ? null : f.id))}
                          title="Editar métricas"
                        >
                          Editar métricas
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="p-2 flex flex-col h-full">
                    {(() => {
                      const baseRows = [
                        { label: "Leads recebidos", value: f.leadsReceived },
                        { label: "Leads qualificados", value: f.leadsQualified },
                        { label: "Vendas realizadas", value: f.leadsWon },
                      ];
                      const metricRows = (Array.isArray(f.lead_metrics) ? f.lead_metrics : [])
                        .filter((m: any) => !m?.isEditing && String(m?.title || "").trim())
                        .map((m: any) => ({ label: String(m.title), value: Number(m.value || 0) }));
                      const rows = [...baseRows, ...metricRows];

                      return (
                        <div className="grid grid-cols-1 gap-0.5 text-[11px] text-gray-900 dark:text-gray-100">
                          {rows.map((item, idx) => (
                            <div
                              key={`${item.label}-${idx}`}
                              className={cn(
                                "flex items-center justify-between",
                                idx < rows.length - 1 && "border-b border-gray-50 dark:border-gray-800 pb-0.5"
                              )}
                            >
                              <span className="truncate pr-2 leading-4">{item.label}</span>
                              <strong className="text-xs whitespace-nowrap min-w-[28px] text-right tabular-nums leading-4">{item.value}</strong>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Aviso (para não ficar "vazio" quando houver poucas linhas) - apenas para quem pode editar */}
                    {canEditIndicatorFunnels && editingMetricsFunnelId !== f.id && (
                      <div className="mt-auto pt-2">
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 px-2 py-2 leading-4">
                          Passe o mouse no título e clique em <span className="font-semibold">Editar métricas</span> para adicionar contagens por <span className="font-semibold">pipeline/coluna</span>.
                        </div>
                      </div>
                    )}

                    {/* Editor (apenas quando o usuário clicar em "Editar métricas" - restrito a quem pode editar) */}
                    {canEditIndicatorFunnels && editingMetricsFunnelId === f.id && (
                      <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Editar métricas
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 rounded-none text-[10px]"
                            onClick={() => addLeadMetric(f.id)}
                            disabled={(pipelines || []).length === 0}
                          >
                            <Plus className="h-3.5 w-3.5 mr-2" />
                            Adicionar
                          </Button>
                        </div>

                        <div className="mt-2 space-y-2">
                          {(Array.isArray(f.lead_metrics) ? f.lead_metrics : []).length === 0 && (
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-gray-800 px-2 py-1">
                              Clique em <span className="font-semibold">Adicionar</span>, escolha título/pipeline/coluna e confirme no ✓.
                            </div>
                          )}

                          {(Array.isArray(f.lead_metrics) ? f.lead_metrics : []).map((m: any) => {
                            const pipelineId = String(m?.pipeline || "all");
                            const columnId = String(m?.column || "all");
                            const cols = pipelineId !== "all" ? (pipelineColumnsMap[pipelineId] || []) : [];
                            const isEditing = !!m?.isEditing;
                            const title = String(m?.title || "");

                            return (
                              <div key={m.id} className="border border-gray-100 dark:border-gray-800 p-2">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    {isEditing ? (
                                      <Input
                                        value={title}
                                        onChange={(e) => patchLeadMetric(f.id, m.id, { title: e.target.value })}
                                        placeholder="Título (ex.: Perdidos 1)"
                                        className="h-8 rounded-none text-[11px] border-gray-300 dark:border-gray-700 dark:bg-[#111111]"
                                      />
                                    ) : (
                                      <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 truncate" title={title || "Métrica"}>
                                        {title || "Métrica"}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1">
                                    {isEditing ? (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-none"
                                        title="Salvar"
                                        onClick={() => saveLeadMetric(f.id, m.id)}
                                      >
                                        <Check className="h-4 w-4" />
                                      </Button>
                                    ) : (
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 rounded-none"
                                        title="Editar"
                                        onClick={() => patchLeadMetric(f.id, m.id, { isEditing: true })}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                    )}

                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 rounded-none text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30"
                                      title="Remover"
                                      onClick={() => removeLeadMetric(f.id, m.id)}
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>

                                {isEditing && (
                                  <div className="mt-2 grid grid-cols-2 gap-1">
                                    <Select
                                      value={pipelineId}
                                      onValueChange={(v) => {
                                        fetchColumnsForPipeline(v);
                                        patchLeadMetric(f.id, m.id, { pipeline: v, column: "all" });
                                      }}
                                    >
                                      <SelectTrigger className="h-8 text-[10px] rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d] px-2">
                                        <SelectValue placeholder="Pipeline" />
                                      </SelectTrigger>
                                      <SelectContent className="rounded-none border-[#d4d4d4] dark:border-gray-700">
                                        <SelectItem value="all">Selecione Pipeline</SelectItem>
                                        {(pipelines || []).map((p) => (
                                          <SelectItem key={p.id} value={p.id}>
                                            {p.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>

                                    <Select
                                      value={columnId}
                                      onValueChange={(v) => patchLeadMetric(f.id, m.id, { column: v })}
                                      disabled={pipelineId === "all"}
                                    >
                                      <SelectTrigger className="h-8 text-[10px] rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d] px-2">
                                        <SelectValue placeholder={pipelineId === "all" ? "Selecione pipeline" : "Coluna"} />
                                      </SelectTrigger>
                                      <SelectContent className="rounded-none border-[#d4d4d4] dark:border-gray-700">
                                        <SelectItem value="all">Selecione Coluna</SelectItem>
                                        {cols.map((c: any) => (
                                          <SelectItem key={c.id} value={c.id}>
                                            {c.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-none border-gray-200 dark:border-gray-700 md:col-span-4 dark:bg-[#1b1b1b] h-full">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs text-gray-700 dark:text-gray-100">
                      Leads por Etiqueta
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    <div className="h-64 flex flex-col overflow-hidden min-w-0">
                      <div className="border border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden min-w-0 h-full">
                        <div className="grid grid-cols-[minmax(0,1fr)_44px_52px] gap-2 px-2 py-1 text-[10px] font-semibold text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800">
                          <span>Nome</span>
                          <span className="text-right tabular-nums">Qtd</span>
                          <span className="text-right tabular-nums">%</span>
                        </div>

                        <div className="flex-1 overflow-y-auto overflow-x-hidden">
                          {f.leadsByTag.length === 0 ? (
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 px-2 py-2">
                              Sem dados
                            </div>
                          ) : (
                            (() => {
                              const total = f.leadsByTag.reduce((sum: number, it: any) => sum + Number(it?.value || 0), 0) || 0;
                              return (
                                <>
                                  {f.leadsByTag.map((item: any) => {
                                    const qty = Number(item?.value || 0);
                                    const pct = total > 0 ? (qty / total) * 100 : 0;
                                    return (
                                      <div
                                        key={item.name}
                                        className="grid grid-cols-[minmax(0,1fr)_44px_52px] gap-2 px-2 py-1 border-b border-gray-50 dark:border-gray-800 last:border-b-0"
                                      >
                                        <span className="truncate" title={item.name}>{item.name}</span>
                                        <span className="text-right tabular-nums">{qty}</span>
                                        <span className="text-right tabular-nums">{pct.toFixed(1)}%</span>
                                      </div>
                                    );
                                  })}
                                </>
                              );
                            })()
                          )}
                        </div>

                        {(() => {
                          const total = f.leadsByTag.reduce((sum: number, it: any) => sum + Number(it?.value || 0), 0) || 0;
                          return (
                            <div className="grid grid-cols-[minmax(0,1fr)_44px_52px] gap-2 px-2 py-1 text-[10px] font-semibold text-gray-700 dark:text-gray-100 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#151515]">
                              <span>Total</span>
                              <span className="text-right tabular-nums">{total}</span>
                              <span className="text-right tabular-nums">{total > 0 ? '100.0%' : '0.0%'}</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-none border-gray-200 dark:border-gray-700 md:col-span-4 dark:bg-[#1b1b1b] h-full">
                  <CardHeader className="py-2 px-3">
                    <CardTitle className="text-xs text-gray-700 dark:text-gray-100">
                      Vendas por Produto
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-3">
                    <div className="h-64 flex flex-col overflow-hidden min-w-0">
                      <div className="border border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden min-w-0 h-full">
                        <div className="grid grid-cols-[minmax(0,1fr)_44px_52px] gap-2 px-2 py-1 text-[10px] font-semibold text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800">
                          <span>Nome</span>
                          <span className="text-right tabular-nums">Qtd</span>
                          <span className="text-right tabular-nums">%</span>
                        </div>

                        <div className="flex-1 overflow-y-auto overflow-x-hidden">
                          {(f.salesByProduct || []).length === 0 ? (
                            <div className="text-[11px] text-gray-500 dark:text-gray-400 px-2 py-2">
                              Sem dados
                            </div>
                          ) : (
                            (() => {
                              const list = (f.salesByProduct || []) as any[];
                              const total = list.reduce((sum: number, it: any) => sum + Number(it?.value || 0), 0) || 0;
                              return (
                                <>
                                  {list.map((item: any) => {
                                    const qty = Number(item?.value || 0);
                                    const pct = total > 0 ? (qty / total) * 100 : 0;
                                    return (
                                      <div
                                        key={item.name}
                                        className="grid grid-cols-[minmax(0,1fr)_44px_52px] gap-2 px-2 py-1 border-b border-gray-50 dark:border-gray-800 last:border-b-0"
                                      >
                                        <span className="truncate" title={item.name}>{item.name}</span>
                                        <span className="text-right tabular-nums">{qty}</span>
                                        <span className="text-right tabular-nums">{pct.toFixed(1)}%</span>
                                      </div>
                                    );
                                  })}
                                </>
                              );
                            })()
                          )}
                        </div>

                        {(() => {
                          const list = (f.salesByProduct || []) as any[];
                          const total = list.reduce((sum: number, it: any) => sum + Number(it?.value || 0), 0) || 0;
                          return (
                            <div className="grid grid-cols-[minmax(0,1fr)_44px_52px] gap-2 px-2 py-1 text-[10px] font-semibold text-gray-700 dark:text-gray-100 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#151515]">
                              <span>Total</span>
                              <span className="text-right tabular-nums">{total}</span>
                              <span className="text-right tabular-nums">{total > 0 ? '100.0%' : '0.0%'}</span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>

              </div>
            ))}
          </div>
        </section>

        {/* Funil – Conversão */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
              <Filter className="h-4 w-4" />
              Funil – Conversão
            </div>
            <div className="flex items-center gap-2 justify-end flex-wrap">
              <Select
                value={customConvAgent}
                onValueChange={(v) => {
                  setCustomConvAgent(v);
                  persistUserReportSettings({
                    customConversionsFilter: {
                      preset: customConvPeriodPreset,
                      startDate: customConvStartDate ? customConvStartDate.toISOString() : null,
                      endDate: customConvEndDate ? customConvEndDate.toISOString() : null,
                      agent: v,
                      tags: customConvTags,
                      status: customConvStatus,
                    },
                  });
                }}
              >
                <SelectTrigger className="h-7 w-[180px] shrink-0 text-[10px] rounded-none bg-gray-400 dark:bg-[#606060] border-gray-300 dark:border-gray-600">
                  <SelectValue placeholder="Agente" />
                </SelectTrigger>
                <SelectContent className="text-[10px] rounded-none">
                  <SelectItem value="all">Todos os agentes</SelectItem>
                  {userRole !== 'user' && <SelectItem value="ia">Agente IA</SelectItem>}
                  {agentsFiltered.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={customConvStatus}
                onValueChange={(v) => {
                  const next = v as any;
                  setCustomConvStatus(next);
                  persistUserReportSettings({
                    customConversionsFilter: {
                      preset: customConvPeriodPreset,
                      startDate: customConvStartDate ? customConvStartDate.toISOString() : null,
                      endDate: customConvEndDate ? customConvEndDate.toISOString() : null,
                      agent: customConvAgent,
                      tags: customConvTags,
                      status: next,
                    },
                  });
                }}
              >
                <SelectTrigger className="h-7 w-[120px] shrink-0 text-[10px] rounded-none bg-gray-400 dark:bg-[#606060] border-gray-300 dark:border-gray-600">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="text-[10px] rounded-none">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="open">Aberto</SelectItem>
                  <SelectItem value="won">Ganho</SelectItem>
                  <SelectItem value="lost">Perdido</SelectItem>
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-[110px] shrink-0 px-2 text-[10px] rounded-none bg-gray-400 dark:bg-[#606060] border-gray-300 dark:border-gray-600 whitespace-nowrap"
                  >
                    Etiquetas{customConvTags.length > 0 ? ` (${customConvTags.length})` : ''}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-72 p-2 rounded-none bg-white text-gray-900 border border-[#d4d4d4] dark:bg-[#1b1b1b] dark:text-gray-100 dark:border-gray-700"
                  align="end"
                >
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {/* Opção de selecionar todas */}
                    {availableTags.length > 0 && (
                      <label className="flex items-center gap-2 text-[11px] font-medium border-b border-gray-200 dark:border-gray-700 pb-2 mb-1">
                        <Checkbox
                          checked={customConvTags.length === availableTags.length && availableTags.length > 0}
                          onCheckedChange={(val) => {
                            const next = val ? availableTags.map((t) => t.id) : [];
                            setCustomConvTags(next);
                            persistUserReportSettings({
                              customConversionsFilter: {
                                preset: customConvPeriodPreset,
                                startDate: customConvStartDate ? customConvStartDate.toISOString() : null,
                                endDate: customConvEndDate ? customConvEndDate.toISOString() : null,
                                agent: customConvAgent,
                                tags: next,
                                status: customConvStatus,
                              },
                            });
                          }}
                        />
                        <span>Selecionar todas</span>
                      </label>
                    )}
                    {availableTags.map((t) => {
                      const checked = customConvTags.includes(t.id);
                      return (
                        <label key={t.id} className="flex items-center gap-2 text-[11px]">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(val) => {
                              const isChecked = !!val;
                              const next = isChecked
                                ? Array.from(new Set([...customConvTags, t.id]))
                                : customConvTags.filter((x) => x !== t.id);
                              setCustomConvTags(next);
                              persistUserReportSettings({
                                customConversionsFilter: {
                                  preset: customConvPeriodPreset,
                                  startDate: customConvStartDate ? customConvStartDate.toISOString() : null,
                                  endDate: customConvEndDate ? customConvEndDate.toISOString() : null,
                                  agent: customConvAgent,
                                  tags: next,
                                  status: customConvStatus,
                                },
                              });
                            }}
                          />
                          <span className="truncate">{t.name}</span>
                        </label>
                      );
                    })}
                  </div>
                  {customConvTags.length > 0 && (
                    <div className="pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-[10px] rounded-none"
                        onClick={() => {
                          setCustomConvTags([]);
                          persistUserReportSettings({
                            customConversionsFilter: {
                              preset: customConvPeriodPreset,
                              startDate: customConvStartDate ? customConvStartDate.toISOString() : null,
                              endDate: customConvEndDate ? customConvEndDate.toISOString() : null,
                              agent: customConvAgent,
                              tags: [],
                              status: customConvStatus,
                            },
                          });
                        }}
                      >
                        Limpar etiquetas
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>

              <Select
                value={customConvPeriodPreset}
                onValueChange={(v) => {
                  const next = v as any;
                  setCustomConvPeriodPreset(next);
                  if (next !== 'custom') {
                    const r = getEffectiveRange(next, null, null);
                    setCustomConvStartDate(r.from);
                    setCustomConvEndDate(r.to);
                    persistUserReportSettings({
                      customConversionsFilter: {
                        preset: next,
                        startDate: r.from ? r.from.toISOString() : null,
                        endDate: r.to ? r.to.toISOString() : null,
                        agent: customConvAgent,
                        tags: customConvTags,
                        status: customConvStatus,
                      },
                    });
                  } else {
                    persistUserReportSettings({
                      customConversionsFilter: {
                        preset: next,
                        startDate: customConvStartDate ? customConvStartDate.toISOString() : null,
                        endDate: customConvEndDate ? customConvEndDate.toISOString() : null,
                        agent: customConvAgent,
                        tags: customConvTags,
                        status: customConvStatus,
                      },
                    });
                  }
                }}
              >
                <SelectTrigger className="h-7 w-[140px] shrink-0 text-[10px] rounded-none bg-gray-400 dark:bg-[#606060] border-gray-300 dark:border-gray-600">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent className="text-[10px] rounded-none">
                  <SelectItem value="all">Todo período</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="last7">Últimos 7 dias</SelectItem>
                  <SelectItem value="last30">Últimos 30 dias</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>

              {customConvPeriodPreset === 'custom' && (
                <>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-[10px] rounded-none bg-gray-400 dark:bg-[#606060] border-gray-300 dark:border-gray-600 whitespace-nowrap"
                      >
                        De: {customConvStartDate ? format(customConvStartDate, 'dd/MM/yyyy') : '—'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 rounded-none bg-white text-gray-900 border border-[#d4d4d4] dark:bg-[#1b1b1b] dark:text-gray-100 dark:border-gray-700"
                      align="end"
                    >
                      <Calendar
                        mode="single"
                        selected={customConvStartDate || undefined}
                        onSelect={(d) => {
                          setCustomConvStartDate(d || null);
                          persistUserReportSettings({
                            customConversionsFilter: {
                              preset: 'custom',
                              startDate: d ? d.toISOString() : null,
                              endDate: customConvEndDate ? customConvEndDate.toISOString() : null,
                              agent: customConvAgent,
                              tags: customConvTags,
                              status: customConvStatus,
                            },
                          });
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-[10px] rounded-none bg-gray-400 dark:bg-[#606060] border-gray-300 dark:border-gray-600 whitespace-nowrap"
                      >
                        Até: {customConvEndDate ? format(customConvEndDate, 'dd/MM/yyyy') : '—'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 rounded-none bg-white text-gray-900 border border-[#d4d4d4] dark:bg-[#1b1b1b] dark:text-gray-100 dark:border-gray-700"
                      align="end"
                    >
                      <Calendar
                        mode="single"
                        selected={customConvEndDate || undefined}
                        onSelect={(d) => {
                          setCustomConvEndDate(d || null);
                          persistUserReportSettings({
                            customConversionsFilter: {
                              preset: 'custom',
                              startDate: customConvStartDate ? customConvStartDate.toISOString() : null,
                              endDate: d ? d.toISOString() : null,
                              agent: customConvAgent,
                              tags: customConvTags,
                              status: customConvStatus,
                            },
                          });
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  {(customConvStartDate || customConvEndDate) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-[10px] rounded-none whitespace-nowrap"
                      onClick={() => {
                        setCustomConvStartDate(null);
                        setCustomConvEndDate(null);
                        persistUserReportSettings({
                          customConversionsFilter: {
                            preset: 'custom',
                            startDate: null,
                            endDate: null,
                            agent: customConvAgent,
                            tags: customConvTags,
                            status: customConvStatus,
                          },
                        });
                      }}
                    >
                      Limpar
                    </Button>
                  )}
                </>
              )}
            </div>
            {canEditCompanyFilters && (
              <Button 
                variant="outline" 
                size="sm" 
                className="h-7 px-2 text-[10px] rounded-none bg-gray-400 dark:bg-[#606060] border-gray-300 dark:border-gray-600"
                onClick={addCustomConversion}
              >
                <Plus className="h-3 w-3 mr-1" />
                Nova Conversão
              </Button>
            )}
          </div>
          <DndContext sensors={canEditCompanyFilters && allowReorder ? dndSensors : []} collisionDetection={closestCenter} onDragEnd={onDragEndCustomConversions}>
            <SortableContext items={customConversions.map((c: any) => c.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {/* Conversões Customizadas */}
            {customConversions.map((conv) => {
              const rng = getEffectiveRange(customConvPeriodPreset, customConvStartDate, customConvEndDate);
              const cardsInRange = filterCardsForSection(cardsScoped || [], rng.from, rng.to, customConvAgent, customConvTags, customConvStatus);

              // Usar histórico de movimentação para contagem mais precisa
              // Cards que PASSARAM pela coluna durante o período são contados
              const countA = cardsInRange.filter((c: any) =>
                (conv.pipelineA === 'all' || c.pipeline_id === conv.pipelineA) &&
                cardPassedThroughColumn(c, conv.columnA, rng.from, rng.to)
              ).length;

              const countB = cardsInRange.filter((c: any) =>
                (conv.pipelineB === 'all' || c.pipeline_id === conv.pipelineB) &&
                cardPassedThroughColumn(c, conv.columnB, rng.from, rng.to)
              ).length;

              const result = conversion(countA, countB);

              // Modo edição só para admin/master
              if (conv.isEditing && canEditCompanyFilters) {
                return (
                  <SortableCard key={conv.id} id={conv.id} disabled>
                    <Card className="rounded-none border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-900/10">
                      <CardContent className="p-2 space-y-2">
                      <Input
                        placeholder="Título da conversão (ex: Leads / Vendas)"
                        value={conv.name}
                        onChange={(e) => setCustomConversions(prev => prev.map(c => c.id === conv.id ? { ...c, name: e.target.value } : c))}
                        className="h-7 text-[10px] rounded-none border-[#d4d4d4] dark:border-gray-700"
                      />
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1">
                          <Select 
                            value={conv.pipelineA} 
                            onValueChange={(v) => {
                              setCustomConversions(prev => prev.map(c => c.id === conv.id ? { ...c, pipelineA: v, columnA: 'all' } : c));
                              fetchColumnsForPipeline(v);
                            }}
                          >
                            <SelectTrigger className="h-7 text-[10px] min-w-[80px] rounded-none border-[#d4d4d4] dark:border-gray-700">
                              <SelectValue placeholder="Pipeline A" />
                            </SelectTrigger>
                            <SelectContent className="text-[10px]">
                              <SelectItem value="all">Todos os Pipelines</SelectItem>
                              {pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <span className="text-[10px] text-gray-400">/</span>
                          <Select 
                            value={conv.columnA} 
                            onValueChange={(v) => setCustomConversions(prev => prev.map(c => c.id === conv.id ? { ...c, columnA: v } : c))}
                            disabled={conv.pipelineA === 'all'}
                          >
                            <SelectTrigger className="h-7 text-[10px] min-w-[80px] rounded-none border-[#d4d4d4] dark:border-gray-700">
                              <SelectValue placeholder={loadingColumnsMap[conv.pipelineA] ? "..." : "Etapas"} />
                            </SelectTrigger>
                            <SelectContent className="text-[10px]">
                              <SelectItem value="all">Todas as Etapas</SelectItem>
                              {(pipelineColumnsMap[conv.pipelineA] || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-1">
                          <Select 
                            value={conv.pipelineB} 
                            onValueChange={(v) => {
                              setCustomConversions(prev => prev.map(c => c.id === conv.id ? { ...c, pipelineB: v, columnB: 'all' } : c));
                              fetchColumnsForPipeline(v);
                            }}
                          >
                            <SelectTrigger className="h-7 text-[10px] min-w-[80px] rounded-none border-[#d4d4d4] dark:border-gray-700">
                              <SelectValue placeholder="Pipeline B" />
                            </SelectTrigger>
                            <SelectContent className="text-[10px]">
                              <SelectItem value="all">Todos os Pipelines</SelectItem>
                              {pipelines.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <span className="text-[10px] text-gray-400">/</span>
                          <Select 
                            value={conv.columnB} 
                            onValueChange={(v) => setCustomConversions(prev => prev.map(c => c.id === conv.id ? { ...c, columnB: v } : c))}
                            disabled={conv.pipelineB === 'all'}
                          >
                            <SelectTrigger className="h-7 text-[10px] min-w-[80px] rounded-none border-[#d4d4d4] dark:border-gray-700">
                              <SelectValue placeholder={loadingColumnsMap[conv.pipelineB] ? "..." : "Etapas"} />
                            </SelectTrigger>
                            <SelectContent className="text-[10px]">
                              <SelectItem value="all">Todas as Etapas</SelectItem>
                              {(pipelineColumnsMap[conv.pipelineB] || []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-1 pt-1">
                        <Button 
                          size="icon" variant="ghost" className="h-6 w-6 text-green-600"
                          onClick={() => {
                            const next = customConversions.map(c => c.id === conv.id ? { ...c, isEditing: false } : c);
                            setCustomConversions(next);
                            saveCompanyConversions({ customConversions: next });
                          }}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600" onClick={() => removeCustomConversion(conv.id)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      </CardContent>
                    </Card>
                  </SortableCard>
                );
              }

              return (
                <SortableCard key={conv.id} id={conv.id} disabled={!allowReorder}>
                  <Card className="rounded-none border-gray-200 dark:border-gray-700 dark:bg-[#1b1b1b] relative group">
                    <CardContent className="p-3">
                    <div className="flex flex-col gap-0.5 mb-1">
                      <div className="text-[11px] font-medium text-gray-700 dark:text-gray-100 truncate">{conv.name || 'Conversão'}</div>
                    </div>
                    <div className="text-xl font-semibold text-gray-900 dark:text-gray-100">{result}%</div>
                    {canEditCompanyFilters && (
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                        <Button 
                          size="icon" variant="ghost" className="h-5 w-5" 
                          onClick={() => {
                            setCustomConversions(prev => prev.map(c => c.id === conv.id ? { ...c, isEditing: true } : c));
                            fetchColumnsForPipeline(conv.pipelineA);
                            fetchColumnsForPipeline(conv.pipelineB);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-5 w-5 text-red-400" onClick={() => removeCustomConversion(conv.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    </CardContent>
                  </Card>
                </SortableCard>
              );
            })}

            {customConversions.length === 0 && (
              <Card className="rounded-none border-gray-200 dark:border-gray-700 dark:bg-[#1b1b1b] sm:col-span-2 md:col-span-3 lg:col-span-4 xl:col-span-5">
                <CardContent className="p-3">
                  <div className="text-[11px] text-gray-600 dark:text-gray-300">
                    {canEditCompanyFilters 
                      ? <>Nenhuma conversão criada. Clique em <span className="font-medium">Nova Conversão</span>.</>
                      : "Nenhuma conversão configurada pelo administrador."
                    }
                  </div>
                </CardContent>
              </Card>
            )}
              </div>
            </SortableContext>
          </DndContext>
        </section>

        {/* Equipe – Indicadores + Equipe – Conversão */}
        <section className="space-y-3">
          <DndContext sensors={canEditCompanyFilters && allowReorder ? dndSensors : []} collisionDetection={closestCenter} onDragEnd={onDragEndTeamConversions}>
            <SortableContext items={teamConversions.map((c: any) => c.id)} strategy={rectSortingStrategy}>
              
              {/* BLOCO SUPERIOR: Indicadores vs (Filtros + Cards) */}
              <div className="flex flex-col lg:flex-row gap-3 items-stretch">
                {/* Esquerda: Indicadores (1/6 da largura aproximada) */}
                <div className="flex flex-col gap-2 lg:w-[16.66%]">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 h-7">
                    <Users className="h-4 w-4" />
                    Equipe – Indicadores
                  </div>
                  <Card className="rounded-none border-gray-200 dark:border-gray-700 dark:bg-[#1b1b1b] flex-1 min-h-0">
                    <CardContent className="p-0 h-full overflow-auto">
                      <div className="border-t border-gray-200 dark:border-gray-800">
                        <table className="w-full text-[11px] table-fixed">
                          <colgroup>
                            <col />
                            <col className="w-[45px]" />
                          </colgroup>
                          <tbody>
                            {[
                              { k: 'Leads recebidos', v: teamSectionCards.length },
                              { k: 'Ligações realizadas', v: teamCalls.length },
                              { k: 'Ligações atendidas', v: teamCallsAttended.length },
                              { k: 'Ligações não atendidas', v: teamCallsNotAttended.length },
                              { k: 'Ligações abordadas', v: teamCallsApproached.length },
                              { k: 'Mensagens enviadas', v: teamMessages.length },
                              { k: 'Reuniões agendadas', v: teamMeetings.length },
                              { k: 'Reuniões realizadas', v: teamMeetingsDone.length },
                              { k: 'Propostas enviadas', v: teamProposals.length },
                              { k: 'Vendas realizadas', v: teamLeadsWon },
                            ].map((row) => (
                              <tr key={row.k} className="border-t border-gray-200 dark:border-gray-800">
                                <td className="px-2 py-1.5 truncate" title={row.k}>{row.k}</td>
                                <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{row.v}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Direita: Conversão (5/6 da largura) */}
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 h-7">
                    <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                      <Users className="h-4 w-4" />
                      Equipe – Conversão
                    </div>
                    {canEditCompanyFilters && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[10px] rounded-none bg-gray-400 dark:bg-[#606060] border-gray-300 dark:border-gray-600"
                        onClick={addTeamConversion}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Nova Conversão
                      </Button>
                    )}
                  </div>

                  {/* Filtros */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full">
                    <Select
                      value={teamConvAgent}
                      onValueChange={(v) => {
                        setTeamConvAgent(v);
                        persistUserReportSettings({
                          teamConversionsFilter: {
                            preset: teamConvPeriodPreset,
                            startDate: teamConvStartDate ? teamConvStartDate.toISOString() : null,
                            endDate: teamConvEndDate ? teamConvEndDate.toISOString() : null,
                            agent: v,
                            tags: teamConvTags,
                            status: teamConvStatus,
                          },
                        });
                      }}
                    >
                      <SelectTrigger className="h-7 w-full text-[10px] rounded-none bg-gray-400 dark:bg-[#606060] border-gray-300 dark:border-gray-600">
                        <SelectValue placeholder="Agente" />
                      </SelectTrigger>
                      <SelectContent className="text-[10px] rounded-none">
                        <SelectItem value="all">Todos os agentes</SelectItem>
                        {userRole !== 'user' && <SelectItem value="ia">Agente IA</SelectItem>}
                        {agentsFiltered.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select
                      value={teamConvStatus}
                      onValueChange={(v) => {
                        const next = v as any;
                        setTeamConvStatus(next);
                        persistUserReportSettings({
                          teamConversionsFilter: {
                            preset: teamConvPeriodPreset,
                            startDate: teamConvStartDate ? teamConvStartDate.toISOString() : null,
                            endDate: teamConvEndDate ? teamConvEndDate.toISOString() : null,
                            agent: teamConvAgent,
                            tags: teamConvTags,
                            status: next,
                          },
                        });
                      }}
                    >
                      <SelectTrigger className="h-7 w-full text-[10px] rounded-none bg-gray-400 dark:bg-[#606060] border-gray-300 dark:border-gray-600">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent className="text-[10px] rounded-none">
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="open">Aberto</SelectItem>
                        <SelectItem value="won">Ganho</SelectItem>
                        <SelectItem value="lost">Perdido</SelectItem>
                      </SelectContent>
                    </Select>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 w-full px-2 text-[10px] rounded-none bg-gray-400 dark:bg-[#606060] border-gray-300 dark:border-gray-600 whitespace-nowrap"
                        >
                          Etiquetas{teamConvTags.length > 0 ? ` (${teamConvTags.length})` : ''}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-72 p-2 rounded-none bg-white text-gray-900 border border-[#d4d4d4] dark:bg-[#1b1b1b] dark:text-gray-100 dark:border-gray-700"
                        align="end"
                      >
                        <div className="max-h-64 overflow-y-auto space-y-2">
                          {/* Opção de selecionar todas */}
                          {availableTags.length > 0 && (
                            <label className="flex items-center gap-2 text-[11px] font-medium border-b border-gray-200 dark:border-gray-700 pb-2 mb-1">
                              <Checkbox
                                checked={teamConvTags.length === availableTags.length && availableTags.length > 0}
                                onCheckedChange={(val) => {
                                  const next = val ? availableTags.map((t) => t.id) : [];
                                  setTeamConvTags(next);
                                  persistUserReportSettings({
                                    teamConversionsFilter: {
                                      preset: teamConvPeriodPreset,
                                      startDate: teamConvStartDate ? teamConvStartDate.toISOString() : null,
                                      endDate: teamConvEndDate ? teamConvEndDate.toISOString() : null,
                                      agent: teamConvAgent,
                                      tags: next,
                                      status: teamConvStatus,
                                    },
                                  });
                                }}
                              />
                              <span>Selecionar todas</span>
                            </label>
                          )}
                          {availableTags.map((t) => {
                            const checked = teamConvTags.includes(t.id);
                            return (
                              <label key={t.id} className="flex items-center gap-2 text-[11px]">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(val) => {
                                    const isChecked = !!val;
                                    const next = isChecked
                                      ? Array.from(new Set([...teamConvTags, t.id]))
                                      : teamConvTags.filter((x) => x !== t.id);
                                    setTeamConvTags(next);
                                    persistUserReportSettings({
                                      teamConversionsFilter: {
                                        preset: teamConvPeriodPreset,
                                        startDate: teamConvStartDate ? teamConvStartDate.toISOString() : null,
                                        endDate: teamConvEndDate ? teamConvEndDate.toISOString() : null,
                                        agent: teamConvAgent,
                                        tags: next,
                                        status: teamConvStatus,
                                      },
                                    });
                                  }}
                                />
                                <span className="truncate">{t.name}</span>
                              </label>
                            );
                          })}
                        </div>
                        {teamConvTags.length > 0 && (
                          <div className="pt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[10px] rounded-none"
                              onClick={() => {
                                setTeamConvTags([]);
                                persistUserReportSettings({
                                  teamConversionsFilter: {
                                    preset: teamConvPeriodPreset,
                                    startDate: teamConvStartDate ? teamConvStartDate.toISOString() : null,
                                    endDate: teamConvEndDate ? teamConvEndDate.toISOString() : null,
                                    agent: teamConvAgent,
                                    tags: [],
                                    status: teamConvStatus,
                                  },
                                });
                              }}
                            >
                              Limpar etiquetas
                            </Button>
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>

                    <Select
                      value={teamConvPeriodPreset}
                      onValueChange={(v) => {
                        const next = v as any;
                        setTeamConvPeriodPreset(next);
                        if (next !== 'custom') {
                          const r = getEffectiveRange(next, null, null);
                          setTeamConvStartDate(r.from);
                          setTeamConvEndDate(r.to);
                          persistUserReportSettings({
                            teamConversionsFilter: {
                              preset: next,
                              startDate: r.from ? r.from.toISOString() : null,
                              endDate: r.to ? r.to.toISOString() : null,
                              agent: teamConvAgent,
                              tags: teamConvTags,
                              status: teamConvStatus,
                            },
                          });
                        } else {
                          persistUserReportSettings({
                            teamConversionsFilter: {
                              preset: next,
                              startDate: teamConvStartDate ? teamConvStartDate.toISOString() : null,
                              endDate: teamConvEndDate ? teamConvEndDate.toISOString() : null,
                              agent: teamConvAgent,
                              tags: teamConvTags,
                              status: teamConvStatus,
                            },
                          });
                        }
                      }}
                    >
                      <SelectTrigger className="h-7 w-full text-[10px] rounded-none bg-gray-400 dark:bg-[#606060] border-gray-300 dark:border-gray-600">
                        <SelectValue placeholder="Período" />
                      </SelectTrigger>
                      <SelectContent className="text-[10px] rounded-none">
                        <SelectItem value="all">Todo período</SelectItem>
                        <SelectItem value="today">Hoje</SelectItem>
                        <SelectItem value="last7">Últimos 7 dias</SelectItem>
                        <SelectItem value="last30">Últimos 30 dias</SelectItem>
                        <SelectItem value="custom">Personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Primeiros 10 Cards (2 linhas de 5) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 flex-1 mt-2">
                    {teamConversions.slice(0, 10).map(renderTeamConversionCard)}
                  </div>
                </div>
              </div>

              {/* BLOCO INFERIOR: Primeiro card com mesma largura do card de Indicadores */}
              <div className="hidden lg:block mt-3">
                {teamConversions.length > 10 && (
                  <div className="flex flex-row gap-3">
                    {/* Primeiro card: mesma largura do card de Indicadores */}
                    <div className="w-[16.66%]">
                      {renderTeamConversionCard(teamConversions[10])}
                    </div>
                    {/* Demais cards: ocupam o espaço restante em grid de 5 colunas */}
                    {teamConversions.length > 11 && (
                      <div className="flex-1 grid grid-cols-5 gap-3">
                        {teamConversions.slice(11).map(renderTeamConversionCard)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Mobile/Tablet: Lista completa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-3">
                {teamConversions.map(renderTeamConversionCard)}
                {teamConversions.length === 0 && (
                  <Card className="rounded-none border-gray-200 dark:border-gray-700 dark:bg-[#1b1b1b] sm:col-span-2">
                    <CardContent className="p-3">
                      <div className="text-[11px] text-gray-600 dark:text-gray-300">
                        {canEditCompanyFilters 
                          ? <>Nenhuma conversão criada. Clique em <span className="font-medium">Nova Conversão</span>.</>
                          : "Nenhuma conversão configurada pelo administrador."
                        }
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

            </SortableContext>
          </DndContext>
        </section>

        {/* Ranking – Vendas */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-100">
              <Users className="h-4 w-4" />
              Equipe – Ranking de Vendas
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Select
                value={salesRankingPreset}
                onValueChange={(v) => {
                  const next = v as ConversionPeriodPreset;
                  setSalesRankingPreset(next);
                  if (next !== 'custom') {
                    const r = getEffectiveRange(next, null, null);
                    setSalesRankingStartDate(r.from);
                    setSalesRankingEndDate(r.to);
                  }
                }}
              >
                <SelectTrigger className="h-7 w-[140px] shrink-0 text-[10px] rounded-none bg-gray-400 dark:bg-[#606060] border-gray-300 dark:border-gray-600">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent className="text-[10px] rounded-none">
                  <SelectItem value="all">Todo período</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="last7">Últimos 7 dias</SelectItem>
                  <SelectItem value="last30">Últimos 30 dias</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>

              {/* Seletor de usuários visíveis (apenas admin/master pode ver e editar) */}
              {canEditCompanyFilters && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-[10px] rounded-none bg-gray-400 dark:bg-[#606060] border-gray-300 dark:border-gray-600 whitespace-nowrap gap-1"
                    >
                      <Users className="h-3 w-3" />
                      {salesRankingUsers.length > 0 ? `${salesRankingUsers.length} usuário(s)` : 'Todos'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-56 p-2 rounded-none bg-white text-gray-900 border border-[#d4d4d4] dark:bg-[#1b1b1b] dark:text-gray-100 dark:border-gray-700"
                    align="end"
                  >
                    <div className="text-[10px] font-semibold mb-2 text-gray-600 dark:text-gray-400">
                      Usuários visíveis no ranking
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {(agents || []).map((a) => (
                        <label key={a.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 px-1">
                          <Checkbox
                            checked={salesRankingUsers.length === 0 || salesRankingUsers.includes(a.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSalesRankingUsers([...salesRankingUsers, a.id]);
                              } else {
                                if (salesRankingUsers.length === 0) {
                                  const allExceptThis = (agents || []).map((ag) => ag.id).filter((id) => id !== a.id);
                                  setSalesRankingUsers(allExceptThis);
                                } else {
                                  const next = salesRankingUsers.filter((id) => id !== a.id);
                                  setSalesRankingUsers(next);
                                }
                              }
                            }}
                          />
                          <span className="text-[10px] truncate">{a.name}</span>
                        </label>
                      ))}
                    </div>
                    {salesRankingUsers.length > 0 && (
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] rounded-none w-full"
                          onClick={() => setSalesRankingUsers([])}
                        >
                          Mostrar todos
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              )}

              {salesRankingPreset === 'custom' && (
                <>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-[10px] rounded-none bg-gray-400 dark:bg-[#606060] border-gray-300 dark:border-gray-600 whitespace-nowrap"
                      >
                        De: {salesRankingStartDate ? format(salesRankingStartDate, 'dd/MM/yyyy') : '—'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 rounded-none bg-white text-gray-900 border border-[#d4d4d4] dark:bg-[#1b1b1b] dark:text-gray-100 dark:border-gray-700"
                      align="end"
                    >
                      <Calendar
                        mode="single"
                        selected={salesRankingStartDate || undefined}
                        onSelect={(d) => setSalesRankingStartDate(d || null)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-[10px] rounded-none bg-gray-400 dark:bg-[#606060] border-gray-300 dark:border-gray-600 whitespace-nowrap"
                      >
                        Até: {salesRankingEndDate ? format(salesRankingEndDate, 'dd/MM/yyyy') : '—'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 rounded-none bg-white text-gray-900 border border-[#d4d4d4] dark:bg-[#1b1b1b] dark:text-gray-100 dark:border-gray-700"
                      align="end"
                    >
                      <Calendar
                        mode="single"
                        selected={salesRankingEndDate || undefined}
                        onSelect={(d) => setSalesRankingEndDate(d || null)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  {(salesRankingStartDate || salesRankingEndDate) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-[10px] rounded-none whitespace-nowrap"
                      onClick={() => {
                        setSalesRankingStartDate(null);
                        setSalesRankingEndDate(null);
                      }}
                    >
                      Limpar
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="h-64 flex flex-col overflow-hidden min-w-0">
            <div className="border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden min-w-0 h-full">
              <div className="flex-1 overflow-y-auto overflow-x-auto">
                <table className="min-w-full text-xs table-auto">
                  <thead className="sticky top-0 z-10 bg-gray-400 dark:bg-[#606060] text-gray-700 dark:text-gray-100 shadow-sm font-bold">
                    <tr>
                      <th className="px-3 py-2 text-left">Usuário</th>
                      <th className="px-3 py-2 text-right">Faturamento</th>
                      <th className="px-3 py-2 text-right">Vendas</th>
                      <th className="px-3 py-2 text-right">Produtos</th>
                      <th className="px-3 py-2 text-right">PA</th>
                      <th className="px-3 py-2 text-right">Ticket médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingVendas.map((row) => (
                      <tr key={row.id} className="border-t border-gray-200 dark:border-gray-800">
                        <td className="px-3 py-2">{row.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Number(row.revenue || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.sales}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.products}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.pa}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {Number(row.ticket || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-10 bg-gray-400 dark:bg-[#606060] text-gray-700 dark:text-gray-100 border-t border-gray-500 dark:border-gray-600 shadow-[0_-1px_3px_rgba(0,0,0,0.1)]">
                    <tr>
                      <td className="px-3 py-2 font-bold">Total</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">
                        {rankingVendasTotals.revenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{rankingVendasTotals.sales}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{rankingVendasTotals.products}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{rankingVendasTotals.pa}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">
                        {rankingVendasTotals.ticket.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Ranking – Trabalho */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-100">
              <Users className="h-4 w-4" />
              Equipe – Ranking de Trabalho
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Select
                value={workRankingPreset}
                onValueChange={(v) => {
                  const next = v as ConversionPeriodPreset;
                  setWorkRankingPreset(next);
                  if (next !== 'custom') {
                    const r = getEffectiveRange(next, null, null);
                    setWorkRankingStartDate(r.from);
                    setWorkRankingEndDate(r.to);
                  }
                }}
              >
                <SelectTrigger className="h-7 w-[140px] shrink-0 text-[10px] rounded-none bg-gray-400 dark:bg-[#606060] border-gray-300 dark:border-gray-600">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent className="text-[10px] rounded-none">
                  <SelectItem value="all">Todo período</SelectItem>
                  <SelectItem value="today">Hoje</SelectItem>
                  <SelectItem value="last7">Últimos 7 dias</SelectItem>
                  <SelectItem value="last30">Últimos 30 dias</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>

              {/* Seletor de usuários visíveis (apenas admin/master pode ver e editar) */}
              {canEditCompanyFilters && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-[10px] rounded-none bg-gray-400 dark:bg-[#606060] border-gray-300 dark:border-gray-600 whitespace-nowrap gap-1"
                    >
                      <Users className="h-3 w-3" />
                      {workRankingUsers.length > 0 ? `${workRankingUsers.length} usuário(s)` : 'Todos'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    className="w-56 p-2 rounded-none bg-white text-gray-900 border border-[#d4d4d4] dark:bg-[#1b1b1b] dark:text-gray-100 dark:border-gray-700"
                    align="end"
                  >
                    <div className="text-[10px] font-semibold mb-2 text-gray-600 dark:text-gray-400">
                      Usuários visíveis no ranking
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {(agents || []).map((a) => (
                        <label key={a.id} className="flex items-center gap-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 px-1">
                          <Checkbox
                            checked={workRankingUsers.length === 0 || workRankingUsers.includes(a.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setWorkRankingUsers([...workRankingUsers, a.id]);
                              } else {
                                if (workRankingUsers.length === 0) {
                                  const allExceptThis = (agents || []).map((ag) => ag.id).filter((id) => id !== a.id);
                                  setWorkRankingUsers(allExceptThis);
                                } else {
                                  const next = workRankingUsers.filter((id) => id !== a.id);
                                  setWorkRankingUsers(next);
                                }
                              }
                            }}
                          />
                          <span className="text-[10px] truncate">{a.name}</span>
                        </label>
                      ))}
                    </div>
                    {workRankingUsers.length > 0 && (
                      <div className="pt-2 border-t border-gray-200 dark:border-gray-700 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] rounded-none w-full"
                          onClick={() => setWorkRankingUsers([])}
                        >
                          Mostrar todos
                        </Button>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              )}

              {workRankingPreset === 'custom' && (
                <>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-[10px] rounded-none bg-gray-400 dark:bg-[#606060] border-gray-300 dark:border-gray-600 whitespace-nowrap"
                      >
                        De: {workRankingStartDate ? format(workRankingStartDate, 'dd/MM/yyyy') : '—'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 rounded-none bg-white text-gray-900 border border-[#d4d4d4] dark:bg-[#1b1b1b] dark:text-gray-100 dark:border-gray-700"
                      align="end"
                    >
                      <Calendar
                        mode="single"
                        selected={workRankingStartDate || undefined}
                        onSelect={(d) => setWorkRankingStartDate(d || null)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 shrink-0 px-2 text-[10px] rounded-none bg-gray-400 dark:bg-[#606060] border-gray-300 dark:border-gray-600 whitespace-nowrap"
                      >
                        Até: {workRankingEndDate ? format(workRankingEndDate, 'dd/MM/yyyy') : '—'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 rounded-none bg-white text-gray-900 border border-[#d4d4d4] dark:bg-[#1b1b1b] dark:text-gray-100 dark:border-gray-700"
                      align="end"
                    >
                      <Calendar
                        mode="single"
                        selected={workRankingEndDate || undefined}
                        onSelect={(d) => setWorkRankingEndDate(d || null)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  {(workRankingStartDate || workRankingEndDate) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 shrink-0 px-2 text-[10px] rounded-none whitespace-nowrap"
                      onClick={() => {
                        setWorkRankingStartDate(null);
                        setWorkRankingEndDate(null);
                      }}
                    >
                      Limpar
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="h-64 flex flex-col overflow-hidden min-w-0">
            <div className="border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden min-w-0 h-full">
              {/* Mantém o comportamento de largura/colunas como estava; apenas fixa header/total e usa scroll Y */}
              <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <table className="w-full text-xs table-auto">
                  <thead className="sticky top-0 z-10 bg-gray-400 dark:bg-[#606060] text-gray-700 dark:text-gray-100 shadow-sm font-bold">
                    <tr>
                      <th className="px-3 py-2 text-left">Usuário</th>
                      <th className="px-3 py-2 text-right">Mensagem</th>
                      <th className="px-3 py-2 text-right">Ligação não atendida</th>
                      <th className="px-3 py-2 text-right">Ligação atendida</th>
                      <th className="px-3 py-2 text-right">Ligação abordada</th>
                      <th className="px-3 py-2 text-right">Ligação agendada</th>
                      <th className="px-3 py-2 text-right">Ligação de follow up</th>
                      <th className="px-3 py-2 text-right">Reunião agendada</th>
                      <th className="px-3 py-2 text-right">Reunião realizada</th>
                      <th className="px-3 py-2 text-right">Reunião não realizada</th>
                      <th className="px-3 py-2 text-right">Reunião reagendada</th>
                      <th className="px-3 py-2 text-right">WhatsApp enviado</th>
                      <th className="px-3 py-2 text-right">Proposta enviada</th>
                      <th className="px-3 py-2 text-right">Venda realizada</th>
                      <th className="px-3 py-2 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankingTrabalho.map((row) => (
                      <tr key={row.id} className="border-t border-gray-200 dark:border-gray-800">
                        <td className="px-3 py-2">{row.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.mensagem}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.ligacao_nao_atendida}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.ligacao_atendida}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.ligacao_abordada}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.ligacao_agendada}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.ligacao_follow_up}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.reuniao_agendada}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.reuniao_realizada}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.reuniao_nao_realizada}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.reuniao_reagendada}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.whatsapp_enviado}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.proposta_enviada}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.venda_realizada}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums">{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 z-10 bg-gray-400 dark:bg-[#606060] text-gray-700 dark:text-gray-100 border-t border-gray-500 dark:border-gray-600 shadow-[0_-1px_3px_rgba(0,0,0,0.1)]">
                    <tr>
                      <td className="px-3 py-2 font-bold">Total</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{rankingTrabalhoTotals.mensagem}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{rankingTrabalhoTotals.ligacao_nao_atendida}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{rankingTrabalhoTotals.ligacao_atendida}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{rankingTrabalhoTotals.ligacao_abordada}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{rankingTrabalhoTotals.ligacao_agendada}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{rankingTrabalhoTotals.ligacao_follow_up}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{rankingTrabalhoTotals.reuniao_agendada}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{rankingTrabalhoTotals.reuniao_realizada}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{rankingTrabalhoTotals.reuniao_nao_realizada}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{rankingTrabalhoTotals.reuniao_reagendada}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{rankingTrabalhoTotals.whatsapp_enviado}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{rankingTrabalhoTotals.proposta_enviada}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{rankingTrabalhoTotals.venda_realizada}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{rankingTrabalhoTotals.total}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}