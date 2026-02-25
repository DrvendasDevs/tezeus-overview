import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Clock, Info } from 'lucide-react';

interface BusinessHoursConfigProps {
  workspaceId: string;
}

interface BusinessHour {
  id?: string;
  day_of_week: number;
  is_enabled: boolean;
  start_time: string;
  end_time: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

export function BusinessHoursConfig({ workspaceId }: BusinessHoursConfigProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);

  useEffect(() => {
    loadBusinessHours();
  }, [workspaceId]);

  const loadBusinessHours = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('workspace_business_hours')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('day_of_week', { ascending: true });

      if (error) throw error;

      // Se não houver dados, criar estrutura vazia
      if (!data || data.length === 0) {
        const emptyHours: BusinessHour[] = DAYS_OF_WEEK.map(day => ({
          day_of_week: day.value,
          is_enabled: false,
          start_time: '08:00',
          end_time: '18:00',
        }));
        setBusinessHours(emptyHours);
      } else {
        // Preencher com dados existentes e adicionar dias faltantes
        const existingDays = new Set(data.map((bh: any) => bh.day_of_week));
        const allHours: BusinessHour[] = DAYS_OF_WEEK.map(day => {
          const existing = data.find((bh: any) => bh.day_of_week === day.value);
          if (existing) {
            return {
              id: existing.id,
              day_of_week: day.value,
              is_enabled: existing.is_enabled,
              start_time: existing.start_time.substring(0, 5), // Remove segundos
              end_time: existing.end_time.substring(0, 5),
            };
          }
          return {
            day_of_week: day.value,
            is_enabled: false,
            start_time: '08:00',
            end_time: '18:00',
          };
        });
        setBusinessHours(allHours);
      }
    } catch (error: any) {
      console.error('Erro ao carregar horários:', error);
      toast({
        title: 'Erro',
        description: 'Erro ao carregar horários de funcionamento',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const updateDay = (dayOfWeek: number, field: keyof BusinessHour, value: any) => {
    setBusinessHours(prev =>
      prev.map(bh =>
        bh.day_of_week === dayOfWeek ? { ...bh, [field]: value } : bh
      )
    );
  };

  const validateTime = (startTime: string, endTime: string): boolean => {
    if (!startTime || !endTime) return false;
    
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    const startTotal = startHours * 60 + startMinutes;
    const endTotal = endHours * 60 + endMinutes;
    
    // Permitir horário que cruza meia-noite
    if (endTotal < startTotal) {
      return true; // Horário que cruza meia-noite é válido
    }
    
    return endTotal > startTotal;
  };

  const handleSave = async () => {
    // Validar todos os horários habilitados
    const enabledDays = businessHours.filter(bh => bh.is_enabled);
    for (const day of enabledDays) {
      if (!validateTime(day.start_time, day.end_time)) {
        toast({
          title: 'Erro de validação',
          description: `Horário inválido para ${DAYS_OF_WEEK.find(d => d.value === day.day_of_week)?.label}. O horário de fim deve ser maior que o de início.`,
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      setSaving(true);

      // Fazer upsert de todos os dias
      const upsertPromises = businessHours.map(async (bh) => {
        const { error } = await supabase
          .from('workspace_business_hours')
          .upsert(
            {
              id: bh.id,
              workspace_id: workspaceId,
              day_of_week: bh.day_of_week,
              is_enabled: bh.is_enabled,
              start_time: `${bh.start_time}:00`,
              end_time: `${bh.end_time}:00`,
            },
            {
              onConflict: 'workspace_id,day_of_week',
            }
          );

        if (error) throw error;
      });

      await Promise.all(upsertPromises);

      toast({
        title: 'Sucesso',
        description: 'Horários de funcionamento salvos com sucesso!',
      });

      // Recarregar dados
      await loadBusinessHours();
    } catch (error: any) {
      console.error('Erro ao salvar horários:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar horários de funcionamento',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const hasAnyConfig = businessHours.some(bh => bh.is_enabled);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 bg-white dark:bg-[#111111] border border-[#d4d4d4] dark:border-gray-700 rounded-none">
        <Loader2 className="h-6 w-6 animate-spin text-gray-600 dark:text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Alert className="border border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#111111] rounded-none">
        <Info className="h-4 w-4 text-gray-600 dark:text-gray-400" />
        <AlertDescription className="text-gray-700 dark:text-gray-300 text-xs">
          {hasAnyConfig
            ? 'Configure os horários de funcionamento para cada dia da semana. Mensagens automáticas serão bloqueadas fora desses horários.'
            : 'Nenhum horário configurado. Mensagens automáticas serão enviadas em qualquer horário. Configure os horários abaixo para ativar a restrição.'}
        </AlertDescription>
      </Alert>

      <div className="border border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#111111] rounded-none">
        <div className="bg-[#f0f0f0] dark:bg-[#1f1f1f] border-b border-[#d4d4d4] dark:border-gray-700 px-4 py-3 rounded-none">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-700 dark:text-gray-300" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Horários de Funcionamento</h3>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Configure os dias e horários em que as automações podem enviar mensagens. Fuso horário: America/Sao_Paulo (UTC-3)
          </p>
        </div>

        <div className="p-4">
          {/* Excel Grid Table */}
          <div className="overflow-auto bg-[#e6e6e6] dark:bg-[#050505]">
            <div className="inline-block min-w-full align-middle bg-white dark:bg-[#111111]">
              <table className="min-w-full border-collapse bg-white text-xs font-sans dark:bg-[#111111] dark:text-gray-100">
                <thead className="bg-[#f3f3f3] sticky top-0 z-10 dark:bg-[#1f1f1f]">
                  <tr>
                    <th className="border border-[#d4d4d4] px-2 py-1 text-left font-semibold text-gray-700 min-w-[200px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                      <div className="flex items-center justify-between">
                        <span>Dia da Semana</span>
                        <div className="w-[1px] h-3 bg-gray-400 mx-1 dark:bg-gray-600" />
                      </div>
                    </th>
                    <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 min-w-[120px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                      <div className="flex items-center justify-between">
                        <span>Ativo</span>
                        <div className="w-[1px] h-3 bg-gray-400 mx-1 dark:bg-gray-600" />
                      </div>
                    </th>
                    <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 min-w-[150px] group hover:bg-[#e1e1e1] cursor-pointer dark:border-gray-700 dark:text-gray-200 dark:hover:bg-[#2a2a2a]">
                      <div className="flex items-center justify-between">
                        <span>Horário Início</span>
                        <div className="w-[1px] h-3 bg-gray-400 mx-1 dark:bg-gray-600" />
                      </div>
                    </th>
                    <th className="border border-[#d4d4d4] px-2 py-1 text-center font-semibold text-gray-700 min-w-[150px] dark:border-gray-700 dark:text-gray-200">
                      <div className="flex items-center justify-between">
                        <span>Horário Fim</span>
                        <div className="w-[1px] h-3 bg-gray-400 mx-1 dark:bg-gray-600" />
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {businessHours.map((bh) => {
                    const dayInfo = DAYS_OF_WEEK.find(d => d.value === bh.day_of_week);
                    const isValid = !bh.is_enabled || validateTime(bh.start_time, bh.end_time);
                    
                    return (
                      <tr key={bh.day_of_week} className="hover:bg-blue-50 group h-[32px] dark:hover:bg-[#1f2937]">
                        <td className="border border-[#e0e0e0] px-2 py-0 font-medium align-middle text-gray-800 dark:border-gray-700 dark:text-gray-200">
                          {dayInfo?.label}
                        </td>
                        <td className="border border-[#e0e0e0] px-2 py-0 text-center align-middle dark:border-gray-700">
                          <div className="flex items-center justify-center h-full">
                            <Switch
                              checked={bh.is_enabled}
                              onCheckedChange={(checked) =>
                                updateDay(bh.day_of_week, 'is_enabled', checked)
                              }
                              className="rounded-none border border-[#d4d4d4] dark:border-gray-700 data-[state=checked]:bg-[#4a9eff] data-[state=unchecked]:bg-[#e0e0e0] dark:data-[state=unchecked]:bg-[#2a2a2a] h-5 w-9"
                              thumbClassName="rounded-none bg-white dark:bg-gray-300 border border-[#d4d4d4] dark:border-gray-600 shadow-none h-4 w-4 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0"
                            />
                          </div>
                        </td>
                        <td className="border border-[#e0e0e0] px-2 py-0 text-center align-middle dark:border-gray-700">
                          <Input
                            type="time"
                            value={bh.start_time}
                            onChange={(e) =>
                              updateDay(bh.day_of_week, 'start_time', e.target.value)
                            }
                            className={`${!isValid ? 'border-red-500' : ''} h-7 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#0b0b0b] text-gray-900 dark:text-gray-100`}
                          />
                        </td>
                        <td className="border border-[#e0e0e0] px-2 py-0 text-center align-middle dark:border-gray-700">
                          <Input
                            type="time"
                            value={bh.end_time}
                            onChange={(e) =>
                              updateDay(bh.day_of_week, 'end_time', e.target.value)
                            }
                            className={`${!isValid ? 'border-red-500' : ''} h-7 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#0b0b0b] text-gray-900 dark:text-gray-100`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end pt-4 mt-4 border-t border-[#d4d4d4] dark:border-gray-700">
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="rounded-none border border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1f1f1f] text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-[#2a2a2a] h-8 px-4 text-xs font-semibold"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-3.5 w-3.5" />
                  Salvar Horários
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

