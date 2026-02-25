import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, MessageSquare } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useTags } from "@/hooks/useTags";
import { useQueues } from "@/hooks/useQueues";

interface FilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApplyFilters?: (filters: FilterData) => void;
  isDarkMode?: boolean;
}

interface FilterData {
  tags: string[];
  queues: string[];
  status: string[];
  selectedDate?: Date;
  dateRange?: { from: Date; to: Date };
  unreadMessages?: boolean;
}

interface Tag {
  id: string;
  name: string;
  color: string;
}

export function FilterModal({ open, onOpenChange, onApplyFilters, isDarkMode = false }: FilterModalProps) {
  const { tags: availableTags, isLoading: tagsLoading } = useTags();
  const { queues: availableQueues, loading: queuesLoading } = useQueues();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedQueues, setSelectedQueues] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date } | undefined>();
  const [showCalendar, setShowCalendar] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState<boolean>(false);

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const toggleQueue = (queueId: string) => {
    setSelectedQueues(prev => 
      prev.includes(queueId) 
        ? prev.filter(id => id !== queueId)
        : [...prev, queueId]
    );
  };


  const handleClear = () => {
    setSelectedTags([]);
    setSelectedQueues([]);
    setSelectedStatuses([]);
    setSelectedDate(undefined);
    setDateRange(undefined);
    setUnreadMessages(false);
    
    // Limpar filtros aplicados também
    if (onApplyFilters) {
      onApplyFilters({
        tags: [],
        queues: [],
        status: [],
        selectedDate: undefined,
        dateRange: undefined,
        unreadMessages: false
      });
    }
  };

  const handleApply = () => {
    const filterData: FilterData = {
      tags: selectedTags,
      queues: selectedQueues,
      status: selectedStatuses,
      selectedDate,
      dateRange,
      unreadMessages
    };
    
    if (onApplyFilters) {
      onApplyFilters(filterData);
    }
    
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-md p-0 gap-0 border border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#0f0f0f] shadow-sm rounded-none ${isDarkMode ? 'dark' : ''}`}>
        <DialogHeader className="bg-primary p-4 rounded-none m-0 dark:bg-[#0b0b0b]">
          <DialogTitle className="text-primary-foreground dark:text-gray-100">Filtros</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 p-6">
          {/* Selecionar etiquetas */}
          <div>
            <Label htmlFor="tags" className={`text-xs font-bold text-gray-700 dark:text-gray-200`}>
              Selecionar etiquetas
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full justify-start text-left font-normal mt-1 h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100`}
                  disabled={tagsLoading}
                >
                  {tagsLoading ? (
                    <span className="text-muted-foreground dark:text-gray-400">Carregando etiquetas...</span>
                  ) : selectedTags.length === 0 ? (
                    <span className="text-muted-foreground dark:text-gray-400">Selecionar etiquetas</span>
                  ) : (
                    <span>{selectedTags.length} etiqueta(s) selecionada(s)</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className={`w-80 p-0 rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1b1b1b]`} align="start">
                <div className="max-h-60 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-yellow-500 scrollbar-track-transparent">
                  {tagsLoading ? (
                    <div className={`p-4 text-center text-muted-foreground dark:text-gray-400 text-xs`}>
                      Carregando etiquetas...
                    </div>
                  ) : availableTags.length === 0 ? (
                    <div className={`p-4 text-center text-muted-foreground dark:text-gray-400 text-xs`}>
                      Nenhuma etiqueta encontrada
                    </div>
                  ) : (
                    availableTags.map((tag) => (
                      <div
                        key={tag.id}
                        className={`flex items-center space-x-2 p-2 hover:bg-[#e6f2ff] dark:hover:bg-[#2a2a2a] rounded-none cursor-pointer`}
                        onClick={() => toggleTag(tag.id)}
                      >
                        <Checkbox
                          checked={selectedTags.includes(tag.id)}
                          onCheckedChange={() => toggleTag(tag.id)}
                          className="rounded-none border-gray-300 dark:border-gray-700 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                        />
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-3 h-3 rounded-full border border-gray-200 dark:border-gray-600"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className={`text-xs text-gray-900 dark:text-gray-100`}>{tag.name}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Selecionar filas */}
          <div>
            <Label htmlFor="queues" className={`text-xs font-bold text-gray-700 dark:text-gray-200`}>
              Selecionar filas
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full justify-start text-left font-normal mt-1 h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100`}
                  disabled={queuesLoading}
                >
                  {queuesLoading ? (
                    <span className="text-muted-foreground dark:text-gray-400">Carregando filas...</span>
                  ) : selectedQueues.length === 0 ? (
                    <span className="text-muted-foreground dark:text-gray-400">Selecionar filas</span>
                  ) : (
                    <span>{selectedQueues.length} fila(s) selecionada(s)</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className={`w-80 p-0 rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1b1b1b]`} align="start">
                <div className="max-h-60 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-yellow-500 scrollbar-track-transparent">
                  {queuesLoading ? (
                    <div className={`p-4 text-center text-muted-foreground dark:text-gray-400 text-xs`}>
                      Carregando filas...
                    </div>
                  ) : availableQueues.length === 0 ? (
                    <div className={`p-4 text-center text-muted-foreground dark:text-gray-400 text-xs`}>
                      Nenhuma fila encontrada
                    </div>
                  ) : (
                    availableQueues.map((queue) => (
                      <div
                        key={queue.id}
                        className={`flex items-center space-x-2 p-2 hover:bg-[#e6f2ff] dark:hover:bg-[#2a2a2a] rounded-none cursor-pointer`}
                        onClick={() => toggleQueue(queue.id)}
                      >
                        <Checkbox
                          checked={selectedQueues.includes(queue.id)}
                          onCheckedChange={() => toggleQueue(queue.id)}
                          className="rounded-none border-gray-300 dark:border-gray-700 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                        />
                        <span className={`text-xs text-gray-900 dark:text-gray-100`}>{queue.name}</span>
                      </div>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Selecionar status */}
          <div>
            <Label htmlFor="status" className={`text-xs font-bold text-gray-700 dark:text-gray-200`}>
              Status da Oportunidade
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full justify-start text-left font-normal mt-1 h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100`}
                >
                  {selectedStatuses.length === 0 ? (
                    <span className="text-muted-foreground dark:text-gray-400">Selecionar status</span>
                  ) : (
                    <span>{selectedStatuses.length} status selecionado(s)</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className={`w-80 p-0 rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1b1b1b]`} align="start">
                <div className="p-2 space-y-1">
                  {['Aberto', 'Ganho', 'Perda'].map(status => (
                    <label
                      key={status}
                      className={`flex items-center space-x-2 p-2 hover:bg-[#e6f2ff] dark:hover:bg-[#2a2a2a] rounded-none cursor-pointer`}
                    >
                      <Checkbox
                        checked={selectedStatuses.includes(status)}
                        onCheckedChange={() => {
                          setSelectedStatuses(prev =>
                            prev.includes(status)
                              ? prev.filter(item => item !== status)
                              : [...prev, status]
                          );
                        }}
                        className="rounded-none border-gray-300 dark:border-gray-700 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                      />
                      <span className={`text-xs text-gray-900 dark:text-gray-100`}>{status}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Mensagens não visualizadas */}
          <div>
            <Label htmlFor="unread-messages" className={`text-xs font-bold text-gray-700 dark:text-gray-200`}>
              Mensagens não visualizadas
            </Label>
            <div className="flex items-center space-x-2 mt-1">
              <Checkbox
                id="unread-messages"
                checked={unreadMessages}
                onCheckedChange={(checked) => setUnreadMessages(checked === true)}
                className="rounded-none border-gray-300 dark:border-gray-700 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
              />
              <label
                htmlFor="unread-messages"
                className="text-xs text-gray-700 dark:text-gray-300 cursor-pointer"
              >
                Mostrar apenas negócios com mensagens não visualizadas
              </label>
            </div>
          </div>

          {/* Seleção de data */}
          <div>
            <Label htmlFor="date-filter" className={`text-xs font-bold text-gray-700 dark:text-gray-200`}>
              Filtrar por data de Criação
            </Label>
            <Popover open={showCalendar} onOpenChange={setShowCalendar}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={`w-full justify-start text-left font-normal mt-1 h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100`}
                >
                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                  {selectedDate ? (
                    format(selectedDate, "dd/MM/yyyy")
                  ) : dateRange ? (
                    `${format(dateRange.from, "dd/MM/yyyy")} - ${format(dateRange.to, "dd/MM/yyyy")}`
                  ) : (
                    "Selecionar data"
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className={`w-auto p-0 rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1b1b1b]`} align="start">
                <Calendar
                  mode="range"
                  selected={dateRange || (selectedDate ? { from: selectedDate, to: selectedDate } : undefined)}
                  onSelect={(range) => {
                    if (range) {
                      if (range.from && range.to) {
                        // Período completo selecionado
                        if (range.from.getTime() !== range.to.getTime()) {
                          setDateRange({ from: range.from, to: range.to });
                          setSelectedDate(undefined);
                        } else {
                          // Mesma data selecionada duas vezes = data única
                          setSelectedDate(range.from);
                          setDateRange(undefined);
                        }
                        // Não fecha mais automaticamente - só ao clicar fora
                      } else if (range.from) {
                        // Apenas primeira data selecionada - manter calendário aberto
                        setDateRange({ from: range.from, to: range.from });
                        setSelectedDate(undefined);
                      }
                    } else {
                      setSelectedDate(undefined);
                      setDateRange(undefined);
                    }
                  }}
                  initialFocus
                  className="pointer-events-auto rounded-none border-0"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className={`flex justify-end space-x-2 p-4 bg-gray-50 dark:bg-[#1a1a1a] border-t border-gray-200 dark:border-gray-700`}>
          <Button variant="ghost" onClick={handleClear} className={`h-8 text-xs rounded-none hover:bg-gray-200 dark:hover:bg-[#2a2a2a] text-gray-700 dark:text-gray-300`}>
            Limpar
          </Button>
          <Button 
            onClick={handleApply}
            className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 text-xs rounded-none font-medium px-4"
          >
            Aplicar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}