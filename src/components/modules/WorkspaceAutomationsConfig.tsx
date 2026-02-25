import { useState, useEffect, useRef, useCallback } from "react";
import { Cake, CalendarDays, Plus, Trash2, X, Loader2, Save, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface WorkspaceAutomationsConfigProps {
  workspaceId: string;
}

interface Connection {
  id: string;
  instance_name: string;
  phone_number: string | null;
  status: string;
}

interface BirthdayConfig {
  id?: string;
  is_enabled: boolean;
  send_time: string;
  message_template: string;
  message_variations: string[];
  connection_id: string | null;
  ignore_business_hours: boolean;
}

interface SeasonalDate {
  id?: string;
  name: string;
  day: number;
  month: number;
  is_enabled: boolean;
  is_predefined: boolean;
  send_time: string;
  message_template: string;
  message_variations: string[];
  connection_id: string | null;
  ignore_business_hours: boolean;
}

const PREDEFINED_DATES: Omit<SeasonalDate, 'id' | 'connection_id'>[] = [
  { name: 'Ano Novo', day: 1, month: 1, is_enabled: false, is_predefined: true, send_time: '09:00', message_template: 'Feliz Ano Novo, {{nome}}! Que este novo ano traga muitas realizações!', message_variations: [], ignore_business_hours: true },
  { name: 'Dia da Mulher', day: 8, month: 3, is_enabled: false, is_predefined: true, send_time: '09:00', message_template: 'Feliz Dia da Mulher, {{nome}}! Parabéns por essa data especial!', message_variations: [], ignore_business_hours: true },
  { name: 'Dia das Mães', day: 11, month: 5, is_enabled: false, is_predefined: true, send_time: '09:00', message_template: 'Feliz Dia das Mães, {{nome}}! Um abraço carinhoso nesta data tão especial!', message_variations: [], ignore_business_hours: true },
  { name: 'Dia dos Namorados', day: 12, month: 6, is_enabled: false, is_predefined: true, send_time: '09:00', message_template: 'Feliz Dia dos Namorados, {{nome}}!', message_variations: [], ignore_business_hours: true },
  { name: 'Dia dos Pais', day: 10, month: 8, is_enabled: false, is_predefined: true, send_time: '09:00', message_template: 'Feliz Dia dos Pais, {{nome}}! Parabéns por essa data tão especial!', message_variations: [], ignore_business_hours: true },
  { name: 'Dia das Crianças', day: 12, month: 10, is_enabled: false, is_predefined: true, send_time: '09:00', message_template: 'Feliz Dia das Crianças! {{nome}}, aproveite essa data especial!', message_variations: [], ignore_business_hours: true },
  { name: 'Natal', day: 25, month: 12, is_enabled: false, is_predefined: true, send_time: '09:00', message_template: 'Feliz Natal, {{nome}}! Que esta data traga muita paz e alegria!', message_variations: [], ignore_business_hours: true },
];

const AUTOMATION_VARIABLES = [
  { tag: '{{nome}}', label: 'Nome' },
  { tag: '{{primeiro_nome}}', label: 'Primeiro Nome' },
  { tag: '{{telefone}}', label: 'Telefone' },
  { tag: '{{email}}', label: 'Email' },
];

const SEASONAL_VARIABLES = [
  ...AUTOMATION_VARIABLES,
  { tag: '{{data_comemorativa}}', label: 'Data Comemorativa' },
];

const HOURS_OPTIONS = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, '0')
);

const MINUTES_OPTIONS = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, '0')
);

export function WorkspaceAutomationsConfig({ workspaceId }: WorkspaceAutomationsConfigProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);

  // Birthday state
  const [birthdayConfig, setBirthdayConfig] = useState<BirthdayConfig>({
    is_enabled: false,
    send_time: '09:00',
    message_template: 'Feliz aniversário, {{nome}}! 🎂',
    message_variations: [],
    connection_id: null,
    ignore_business_hours: true,
  });
  const [birthdayExpanded, setBirthdayExpanded] = useState(true);

  // Seasonal state
  const [seasonalDates, setSeasonalDates] = useState<SeasonalDate[]>([]);
  const [seasonalExpanded, setSeasonalExpanded] = useState(true);
  const [expandedSeasonalId, setExpandedSeasonalId] = useState<string | null>(null);
  const [showNewSeasonalForm, setShowNewSeasonalForm] = useState(false);
  const [newSeasonal, setNewSeasonal] = useState<Omit<SeasonalDate, 'id'>>({
    name: '',
    day: 1,
    month: 1,
    is_enabled: true,
    is_predefined: false,
    send_time: '09:00',
    message_template: '',
    message_variations: [],
    connection_id: null,
    ignore_business_hours: true,
  });

  // Refs for cursor position
  const birthdayTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Load data
  useEffect(() => {
    if (workspaceId) {
      loadData();
    }
  }, [workspaceId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: conns } = await supabase
        .from('connections')
        .select('id, instance_name, phone_number, status')
        .eq('workspace_id', workspaceId)
        .eq('status', 'connected');
      setConnections(conns || []);

      const { data: birthday } = await supabase
        .from('workspace_birthday_automation')
        .select('*')
        .eq('workspace_id', workspaceId)
        .maybeSingle();

      if (birthday) {
        setBirthdayConfig({
          id: birthday.id,
          is_enabled: birthday.is_enabled,
          send_time: birthday.send_time || '09:00',
          message_template: birthday.message_template,
          message_variations: birthday.message_variations || [],
          connection_id: birthday.connection_id,
          ignore_business_hours: birthday.ignore_business_hours ?? true,
        });
      }

      const { data: seasonal } = await supabase
        .from('workspace_seasonal_dates')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('month', { ascending: true })
        .order('day', { ascending: true });

      if (seasonal && seasonal.length > 0) {
        setSeasonalDates(seasonal.map((s: any) => ({
          id: s.id,
          name: s.name,
          day: s.day,
          month: s.month,
          is_enabled: s.is_enabled,
          is_predefined: s.is_predefined,
          send_time: s.send_time || '09:00',
          message_template: s.message_template,
          message_variations: s.message_variations || [],
          connection_id: s.connection_id,
          ignore_business_hours: s.ignore_business_hours ?? true,
        })));
      } else {
        setSeasonalDates(PREDEFINED_DATES.map(d => ({ ...d, connection_id: null })));
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const insertVariable = useCallback((textareaRef: React.RefObject<HTMLTextAreaElement>, tag: string, setValue: (v: string) => void, currentValue: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setValue(currentValue + tag);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = currentValue.substring(0, start) + tag + currentValue.substring(end);
    setValue(newValue);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + tag.length, start + tag.length);
    }, 0);
  }, []);

  const saveBirthdayConfig = async () => {
    setIsSaving(true);
    try {
      const data = {
        workspace_id: workspaceId,
        is_enabled: birthdayConfig.is_enabled,
        send_time: birthdayConfig.send_time,
        message_template: birthdayConfig.message_template,
        message_variations: birthdayConfig.message_variations.filter(v => v.trim()),
        connection_id: birthdayConfig.connection_id,
        ignore_business_hours: birthdayConfig.ignore_business_hours,
        updated_at: new Date().toISOString(),
      };

      if (birthdayConfig.id) {
        const { error } = await supabase
          .from('workspace_birthday_automation')
          .update(data)
          .eq('id', birthdayConfig.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from('workspace_birthday_automation')
          .insert(data)
          .select()
          .single();
        if (error) throw error;
        setBirthdayConfig(prev => ({ ...prev, id: inserted.id }));
      }

      toast({ title: "Sucesso", description: "Automação de aniversário salva!" });
    } catch (error) {
      console.error('Erro ao salvar automação de aniversário:', error);
      toast({ title: "Erro", description: "Erro ao salvar automação de aniversário.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const saveSeasonalDate = async (date: SeasonalDate, index: number) => {
    setIsSaving(true);
    try {
      const data = {
        workspace_id: workspaceId,
        name: date.name,
        day: date.day,
        month: date.month,
        is_enabled: date.is_enabled,
        is_predefined: date.is_predefined,
        send_time: date.send_time,
        message_template: date.message_template,
        message_variations: date.message_variations.filter(v => v.trim()),
        connection_id: date.connection_id,
        ignore_business_hours: date.ignore_business_hours,
        updated_at: new Date().toISOString(),
      };

      if (date.id) {
        const { error } = await supabase
          .from('workspace_seasonal_dates')
          .update(data)
          .eq('id', date.id);
        if (error) throw error;
      } else {
        const { data: inserted, error } = await supabase
          .from('workspace_seasonal_dates')
          .insert(data)
          .select()
          .single();
        if (error) throw error;
        setSeasonalDates(prev => prev.map((d, i) => i === index ? { ...d, id: inserted.id } : d));
      }

      toast({ title: "Sucesso", description: `Data sazonal "${date.name}" salva!` });
    } catch (error) {
      console.error('Erro ao salvar data sazonal:', error);
      toast({ title: "Erro", description: "Erro ao salvar data sazonal.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSeasonalDate = async (date: SeasonalDate, index: number) => {
    if (date.is_predefined) return;
    try {
      if (date.id) {
        const { error } = await supabase
          .from('workspace_seasonal_dates')
          .delete()
          .eq('id', date.id);
        if (error) throw error;
      }
      setSeasonalDates(prev => prev.filter((_, i) => i !== index));
      toast({ title: "Sucesso", description: `Data "${date.name}" removida.` });
    } catch (error) {
      console.error('Erro ao deletar data sazonal:', error);
      toast({ title: "Erro", description: "Erro ao remover data sazonal.", variant: "destructive" });
    }
  };

  const addNewSeasonalDate = () => {
    if (!newSeasonal.name.trim() || !newSeasonal.message_template.trim()) {
      toast({ title: "Erro", description: "Preencha o nome e a mensagem.", variant: "destructive" });
      return;
    }
    setSeasonalDates(prev => [...prev, { ...newSeasonal }]);
    setNewSeasonal({
      name: '',
      day: 1,
      month: 1,
      is_enabled: true,
      is_predefined: false,
      send_time: '09:00',
      message_template: '',
      message_variations: [],
      connection_id: null,
      ignore_business_hours: true,
    });
    setShowNewSeasonalForm(false);
  };

  const updateSeasonalDate = (index: number, updates: Partial<SeasonalDate>) => {
    setSeasonalDates(prev => prev.map((d, i) => i === index ? { ...d, ...updates } : d));
  };

  const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  // Time picker (same pattern as AutomationModal)
  const renderTimePicker = (currentTime: string, onChange: (time: string) => void) => {
    const [h, m] = (currentTime || '09:00').split(':');
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between h-8 text-xs rounded-none border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 px-3 focus-visible:outline-none focus-visible:ring-0"
          >
            <span>{currentTime || 'Selecione o horário'}</span>
            <span className="text-[10px] text-gray-500 dark:text-gray-400">▼</span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] p-3 w-56">
          <div className="flex items-center gap-2">
            <Select
              value={h || '00'}
              onValueChange={(value) => onChange(`${value}:${m || '00'}`)}
            >
              <SelectTrigger className="h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]">
                {HOURS_OPTIONS.map((hour) => (
                  <SelectItem key={hour} value={hour} className="text-xs rounded-none text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]">
                    {hour}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-xs text-gray-600 dark:text-gray-300">:</span>
            <Select
              value={m || '00'}
              onValueChange={(value) => onChange(`${h || '00'}:${value}`)}
            >
              <SelectTrigger className="h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]">
                {MINUTES_OPTIONS.map((minute) => (
                  <SelectItem key={minute} value={minute} className="text-xs rounded-none text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]">
                    {minute}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  // Render variable buttons
  const renderVariableButtons = (variables: typeof AUTOMATION_VARIABLES, textareaRef: React.RefObject<HTMLTextAreaElement> | null, setValue: (v: string) => void, currentValue: string) => (
    <div className="flex flex-wrap gap-1 mt-1">
      {variables.map(v => (
        <button
          key={v.tag}
          type="button"
          onClick={() => {
            if (textareaRef) {
              insertVariable(textareaRef, v.tag, setValue, currentValue);
            } else {
              setValue(currentValue + v.tag);
            }
          }}
          className="px-2 py-0.5 text-[10px] rounded-none bg-gray-100 dark:bg-[#2a2a2a] text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-[#333] transition-colors"
        >
          {v.label}
        </button>
      ))}
    </div>
  );

  // Render message section (main message + variations)
  const renderMessageSection = (
    mainMessage: string,
    variations: string[],
    onMainChange: (v: string) => void,
    onVariationsChange: (v: string[]) => void,
    variables: typeof AUTOMATION_VARIABLES,
    mainRef?: React.RefObject<HTMLTextAreaElement> | null
  ) => (
    <div className="space-y-3">
      <div>
        <Label className="text-gray-700 dark:text-gray-200">Mensagem principal</Label>
        <Textarea
          ref={mainRef || undefined}
          value={mainMessage}
          onChange={e => onMainChange(e.target.value)}
          rows={3}
          className="mt-1 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
          placeholder="Digite a mensagem..."
        />
        {renderVariableButtons(variables, mainRef || null, onMainChange, mainMessage)}
      </div>

      {variations.map((variation, i) => (
        <div key={i}>
          <div className="flex items-center justify-between">
            <Label className="text-gray-700 dark:text-gray-200 text-xs">Variação {i + 1}</Label>
            <button
              type="button"
              onClick={() => onVariationsChange(variations.filter((_, vi) => vi !== i))}
              className="text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <Textarea
            value={variation}
            onChange={e => onVariationsChange(variations.map((v, vi) => vi === i ? e.target.value : v))}
            rows={3}
            className="mt-1 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
            placeholder={`Variação ${i + 1}...`}
          />
          {renderVariableButtons(variables, null, (val) => onVariationsChange(variations.map((v, vi) => vi === i ? val : v)), variation)}
        </div>
      ))}

      {variations.length < 2 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onVariationsChange([...variations, ''])}
          className="text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]"
        >
          <Plus className="h-3 w-3 mr-1" /> Adicionar variação
        </Button>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground dark:text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 px-2">
      {/* ===== SEÇÃO: ANIVERSÁRIO ===== */}
      <div className="border border-gray-300 dark:border-gray-700 rounded-none overflow-hidden">
        <button
          type="button"
          onClick={() => setBirthdayExpanded(!birthdayExpanded)}
          className="w-full flex items-center justify-between p-4 bg-[#f3f3f3] dark:bg-[#1b1b1b] hover:bg-[#ebebeb] dark:hover:bg-[#222] transition-colors"
        >
          <div className="flex items-center gap-3">
            <Cake className="h-5 w-5 text-pink-500 dark:text-pink-400" />
            <div className="text-left">
              <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">Automação de Aniversário</h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Enviar mensagem automática no aniversário dos contatos</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-2 py-0.5 rounded-none text-[10px] font-medium ${birthdayConfig.is_enabled ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
              {birthdayConfig.is_enabled ? 'Ativo' : 'Inativo'}
            </div>
            {birthdayExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </button>

        {birthdayExpanded && (
          <div className="p-4 space-y-4 border-t border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0f0f0f]">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-gray-700 dark:text-gray-200">Ativar automação</Label>
              <Switch
                checked={birthdayConfig.is_enabled}
                onCheckedChange={(v) => setBirthdayConfig(prev => ({ ...prev, is_enabled: v }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1.5 block">Horário de envio</Label>
                {renderTimePicker(birthdayConfig.send_time, (v) => setBirthdayConfig(prev => ({ ...prev, send_time: v })))}
              </div>
              <div>
                <Label className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1.5 block">Conexão WhatsApp</Label>
                <Select
                  value={birthdayConfig.connection_id || 'auto'}
                  onValueChange={v => setBirthdayConfig(prev => ({ ...prev, connection_id: v === 'auto' ? null : v }))}
                >
                  <SelectTrigger className="h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 focus:ring-0">
                    <SelectValue placeholder="Automática" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]">
                    <SelectItem value="auto" className="text-xs rounded-none text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]">Automática (da conversa)</SelectItem>
                    {connections.map(c => (
                      <SelectItem key={c.id} value={c.id} className="text-xs rounded-none text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]">
                        {c.instance_name} {c.phone_number ? `(${c.phone_number})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {renderMessageSection(
              birthdayConfig.message_template,
              birthdayConfig.message_variations,
              (v) => setBirthdayConfig(prev => ({ ...prev, message_template: v })),
              (v) => setBirthdayConfig(prev => ({ ...prev, message_variations: v })),
              AUTOMATION_VARIABLES,
              birthdayTextareaRef
            )}

            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Switch
                  checked={birthdayConfig.ignore_business_hours}
                  onCheckedChange={(v) => setBirthdayConfig(prev => ({ ...prev, ignore_business_hours: v }))}
                />
                <Label className="text-[10px] text-gray-500 dark:text-gray-400">Ignorar horário de funcionamento</Label>
              </div>
              <Button
                onClick={saveBirthdayConfig}
                disabled={isSaving}
                size="sm"
                className="gap-1 rounded-none text-xs"
              >
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Salvar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ===== SEÇÃO: DATAS SAZONAIS ===== */}
      <div className="border border-gray-300 dark:border-gray-700 rounded-none overflow-hidden">
        <button
          type="button"
          onClick={() => setSeasonalExpanded(!seasonalExpanded)}
          className="w-full flex items-center justify-between p-4 bg-[#f3f3f3] dark:bg-[#1b1b1b] hover:bg-[#ebebeb] dark:hover:bg-[#222] transition-colors"
        >
          <div className="flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-orange-500 dark:text-orange-400" />
            <div className="text-left">
              <h3 className="text-xs font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">Datas Sazonais</h3>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">Enviar mensagens em datas comemorativas</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-2 py-0.5 rounded-none text-[10px] font-medium ${seasonalDates.some(d => d.is_enabled) ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
              {seasonalDates.filter(d => d.is_enabled).length} ativa(s)
            </div>
            {seasonalExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </button>

        {seasonalExpanded && (
          <div className="border-t border-gray-300 dark:border-gray-700">
            {/* Lista de datas sazonais */}
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {seasonalDates.map((date, index) => (
                <div key={date.id || `new-${index}`} className="hover:bg-[#f9f9f9] dark:hover:bg-[#161616] transition-colors">
                  {/* Header da data */}
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Switch
                        checked={date.is_enabled}
                        onCheckedChange={(v) => updateSeasonalDate(index, { is_enabled: v })}
                      />
                      <button
                        type="button"
                        onClick={() => setExpandedSeasonalId(expandedSeasonalId === (date.id || `new-${index}`) ? null : (date.id || `new-${index}`))}
                        className="flex items-center gap-2 text-left flex-1 min-w-0"
                      >
                        <span className="text-xs font-medium text-gray-900 dark:text-gray-100 truncate">{date.name}</span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 flex-shrink-0">
                          {String(date.day).padStart(2, '0')}/{String(date.month).padStart(2, '0')} - {date.send_time}
                        </span>
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      {!date.is_predefined && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteSeasonalDate(date, index)}
                          className="h-7 w-7 p-0 rounded-none text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <button
                        type="button"
                        onClick={() => setExpandedSeasonalId(expandedSeasonalId === (date.id || `new-${index}`) ? null : (date.id || `new-${index}`))}
                      >
                        {expandedSeasonalId === (date.id || `new-${index}`) ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </button>
                    </div>
                  </div>

                  {/* Detalhes expandidos */}
                  {expandedSeasonalId === (date.id || `new-${index}`) && (
                    <div className="px-4 pb-4 space-y-3 bg-white dark:bg-[#0f0f0f] border-t border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-3 gap-3 pt-3">
                        <div>
                          <Label className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1.5 block">Dia</Label>
                          <Input
                            type="number"
                            min={1}
                            max={31}
                            value={date.day}
                            onChange={e => updateSeasonalDate(index, { day: parseInt(e.target.value) || 1 })}
                            disabled={date.is_predefined}
                            className="h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 focus-visible:ring-0"
                          />
                        </div>
                        <div>
                          <Label className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1.5 block">Mês</Label>
                          <Select
                            value={String(date.month)}
                            onValueChange={v => updateSeasonalDate(index, { month: parseInt(v) })}
                            disabled={date.is_predefined}
                          >
                            <SelectTrigger className="h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 focus:ring-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]">
                              {MONTHS.map((m, i) => (
                                <SelectItem key={i + 1} value={String(i + 1)} className="text-xs rounded-none text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]">{m}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1.5 block">Horário</Label>
                          {renderTimePicker(date.send_time, (v) => updateSeasonalDate(index, { send_time: v }))}
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1.5 block">Conexão WhatsApp</Label>
                        <Select
                          value={date.connection_id || 'auto'}
                          onValueChange={v => updateSeasonalDate(index, { connection_id: v === 'auto' ? null : v })}
                        >
                          <SelectTrigger className="h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 focus:ring-0">
                            <SelectValue placeholder="Automática" />
                          </SelectTrigger>
                          <SelectContent className="rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]">
                            <SelectItem value="auto" className="text-xs rounded-none text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]">Automática (da conversa)</SelectItem>
                            {connections.map(c => (
                              <SelectItem key={c.id} value={c.id} className="text-xs rounded-none text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]">
                                {c.instance_name} {c.phone_number ? `(${c.phone_number})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {renderMessageSection(
                        date.message_template,
                        date.message_variations,
                        (v) => updateSeasonalDate(index, { message_template: v }),
                        (v) => updateSeasonalDate(index, { message_variations: v }),
                        SEASONAL_VARIABLES,
                        null
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={date.ignore_business_hours}
                            onCheckedChange={(v) => updateSeasonalDate(index, { ignore_business_hours: v })}
                          />
                          <Label className="text-[10px] text-gray-500 dark:text-gray-400">Ignorar horário de funcionamento</Label>
                        </div>
                        <Button
                          onClick={() => saveSeasonalDate(date, index)}
                          disabled={isSaving}
                          size="sm"
                          className="gap-1 rounded-none text-xs"
                        >
                          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          Salvar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Formulário nova data personalizada */}
            {showNewSeasonalForm ? (
              <div className="p-4 border-t border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0f0f0f] space-y-3">
                <h4 className="text-xs font-bold text-gray-700 dark:text-gray-200 uppercase tracking-wide">Nova data personalizada</h4>
                <div className="grid grid-cols-4 gap-3">
                  <div className="col-span-2">
                    <Label className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1.5 block">Nome</Label>
                    <Input
                      value={newSeasonal.name}
                      onChange={e => setNewSeasonal(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Ex: Dia do Cliente"
                      className="h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400 focus-visible:ring-0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1.5 block">Dia</Label>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={newSeasonal.day}
                      onChange={e => setNewSeasonal(prev => ({ ...prev, day: parseInt(e.target.value) || 1 }))}
                      className="h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 focus-visible:ring-0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1.5 block">Mês</Label>
                    <Select
                      value={String(newSeasonal.month)}
                      onValueChange={v => setNewSeasonal(prev => ({ ...prev, month: parseInt(v) }))}
                    >
                      <SelectTrigger className="h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 focus:ring-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]">
                        {MONTHS.map((m, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)} className="text-xs rounded-none text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]">{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1.5 block">Horário de envio</Label>
                    {renderTimePicker(newSeasonal.send_time, (v) => setNewSeasonal(prev => ({ ...prev, send_time: v })))}
                  </div>
                  <div>
                    <Label className="text-xs font-bold text-gray-700 dark:text-gray-200 mb-1.5 block">Conexão WhatsApp</Label>
                    <Select
                      value={newSeasonal.connection_id || 'auto'}
                      onValueChange={v => setNewSeasonal(prev => ({ ...prev, connection_id: v === 'auto' ? null : v }))}
                    >
                      <SelectTrigger className="h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 focus:ring-0">
                        <SelectValue placeholder="Automática" />
                      </SelectTrigger>
                      <SelectContent className="rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b]">
                        <SelectItem value="auto" className="text-xs rounded-none text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]">Automática (da conversa)</SelectItem>
                        {connections.map(c => (
                          <SelectItem key={c.id} value={c.id} className="text-xs rounded-none text-gray-900 dark:text-gray-100 focus:bg-gray-100 dark:focus:bg-[#2a2a2a]">
                            {c.instance_name} {c.phone_number ? `(${c.phone_number})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label className="text-gray-700 dark:text-gray-200">Mensagem</Label>
                  <Textarea
                    value={newSeasonal.message_template}
                    onChange={e => setNewSeasonal(prev => ({ ...prev, message_template: e.target.value }))}
                    rows={3}
                    className="mt-1 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                    placeholder="Digite a mensagem..."
                  />
                  {renderVariableButtons(SEASONAL_VARIABLES, null, (v) => setNewSeasonal(prev => ({ ...prev, message_template: v })), newSeasonal.message_template)}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowNewSeasonalForm(false)}
                    className="rounded-none text-xs border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]"
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={addNewSeasonalDate}
                    className="gap-1 rounded-none text-xs"
                  >
                    <Plus className="h-3 w-3" /> Adicionar
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-3 border-t border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0f0f0f]">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewSeasonalForm(true)}
                  className="w-full gap-1 rounded-none text-xs border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#2a2a2a]"
                >
                  <Plus className="h-3 w-3" /> Nova data personalizada
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
