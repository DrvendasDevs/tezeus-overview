
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PeriodFilterModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPeriodSelect: (period: { startDate: Date; endDate: Date; label: string }) => void;
  isDarkMode?: boolean;
}

export function PeriodFilterModal({ open, onOpenChange, onPeriodSelect, isDarkMode }: PeriodFilterModalProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  const periodOptions = [
    { label: "Hoje", value: "hoje" },
    { label: "Ontem", value: "ontem" },
    { label: "Esta semana", value: "esta-semana" },
    { label: "Semana passada", value: "semana-passada" },
    { label: "Este mês", value: "este-mes" },
    { label: "Mês passado", value: "mes-passado" },
    { label: "Últimos 7 dias", value: "ultimos-7-dias" },
  ];

  const months = [
    "janeiro", "fevereiro", "março", "abril", "maio", "junho",
    "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
  ];

  const handlePeriodClick = (value: string) => {
    setSelectedPeriod(value);
    const today = new Date();
    let start: Date;
    let end: Date;

    switch (value) {
      case "hoje":
        start = end = today;
        break;
      case "ontem":
        start = end = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "esta-semana":
        const startOfWeek = new Date(today);
        startOfWeek.setDate(today.getDate() - today.getDay());
        start = startOfWeek;
        end = today;
        break;
      case "semana-passada":
        const lastWeekStart = new Date(today);
        lastWeekStart.setDate(today.getDate() - today.getDay() - 7);
        const lastWeekEnd = new Date(lastWeekStart);
        lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
        start = lastWeekStart;
        end = lastWeekEnd;
        break;
      case "este-mes":
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = today;
        break;
      case "mes-passado":
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case "ultimos-7-dias":
        start = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        end = today;
        break;
      default:
        return;
    }

    // Atualiza as datas no calendário
    setStartDate(start);
    setEndDate(end);
    
    // Atualiza o mês do calendário para mostrar a data selecionada
    setCurrentMonth(start.getMonth());
    setCurrentYear(start.getFullYear());
    
    // Aplica o filtro mas mantém o modal aberto
    const periodOption = periodOptions.find(p => p.value === value);
    if (periodOption) {
      onPeriodSelect({
        startDate: start,
        endDate: end,
        label: periodOption.label
      });
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!startDate || (startDate && endDate)) {
      setStartDate(date);
      setEndDate(undefined);
      setSelectedPeriod(""); // Limpa a seleção de período predefinido
    } else if (startDate && !endDate) {
      if (date && date >= startDate) {
        setEndDate(date);
      } else {
        setStartDate(date);
        setEndDate(undefined);
      }
      setSelectedPeriod(""); // Limpa a seleção de período predefinido
    }
  };

  const handleApplyCustomDates = () => {
    if (startDate && endDate) {
      const label = `${format(startDate, "dd/MM/yyyy")} - ${format(endDate, "dd/MM/yyyy")}`;
      onPeriodSelect({
        startDate,
        endDate,
        label
      });
      onOpenChange(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className={cn(
          "max-w-2xl p-0 gap-0",
          isDarkMode ? "bg-gray-800 border-gray-600" : "bg-white"
        )}
      >
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className={cn(
            "text-lg font-semibold",
            isDarkMode ? "text-white" : "text-gray-900"
          )}>
            Filtrar por período
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex">
          {/* Left side - Period Options */}
          <div className={cn(
            "w-48 p-4 border-r space-y-2",
            isDarkMode ? "border-gray-600" : "border-gray-200"
          )}>
            {periodOptions.map((option) => (
              <Button
                key={option.value}
                variant={selectedPeriod === option.value ? "default" : "ghost"}
                className={cn(
                  "w-full justify-start text-sm",
                  selectedPeriod === option.value 
                    ? "bg-yellow-500 text-black hover:bg-yellow-600" 
                    : isDarkMode 
                      ? "text-gray-300 hover:bg-gray-700" 
                      : "text-gray-700 hover:bg-gray-100"
                )}
                onClick={() => handlePeriodClick(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {/* Right side - Calendar */}
          <div className="flex-1 p-4">
            <div className="flex items-center justify-between mb-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateMonth('prev')}
                className={cn(
                  "h-8 w-8",
                  isDarkMode ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              
              <div className={cn(
                "text-sm font-medium",
                isDarkMode ? "text-white" : "text-gray-900"
              )}>
                {months[currentMonth]} {currentYear}
              </div>
              
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigateMonth('next')}
                className={cn(
                  "h-8 w-8",
                  isDarkMode ? "text-gray-300 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"
                )}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <Calendar
              mode="range"
              selected={{
                from: startDate,
                to: endDate
              }}
              onSelect={(range) => {
                if (range?.from) {
                  setStartDate(range.from);
                  setEndDate(range.to);
                  setSelectedPeriod(""); // Limpa a seleção de período predefinido
                }
              }}
              month={new Date(currentYear, currentMonth)}
              locale={ptBR}
              className={cn(
                "w-full pointer-events-auto",
                isDarkMode ? "text-white" : "text-gray-900"
              )}
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-sm font-medium",
                nav: "space-x-1 flex items-center",
                nav_button: cn(
                  "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
                ),
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse space-y-1",
                head_row: "flex",
                head_cell: "text-gray-500 rounded-md w-8 font-normal text-[0.8rem]",
                row: "flex w-full mt-2",
                cell: cn(
                  "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-yellow-100 [&:has([aria-selected].day-outside)]:bg-yellow-100/50 [&:has([aria-selected].day-range-end)]:rounded-r-md",
                  isDarkMode ? "[&:has([aria-selected])]:bg-yellow-900/20" : ""
                ),
                day: cn(
                  "h-8 w-8 p-0 font-normal aria-selected:opacity-100",
                  isDarkMode ? "text-white hover:bg-gray-700" : "hover:bg-gray-100"
                ),
                day_range_start: "day-range-start",
                day_range_end: "day-range-end",
                day_selected: cn(
                  "bg-yellow-500 text-black hover:bg-yellow-500 hover:text-black focus:bg-yellow-500 focus:text-black"
                ),
                day_today: cn(
                  "bg-gray-100 text-gray-900",
                  isDarkMode ? "bg-gray-700 text-white" : ""
                ),
                day_outside: cn(
                  "day-outside text-gray-500 opacity-50 aria-selected:bg-yellow-100/50 aria-selected:text-gray-500 aria-selected:opacity-30",
                  isDarkMode ? "text-gray-400" : ""
                ),
                day_disabled: "text-gray-500 opacity-50",
                day_range_middle: cn(
                  "aria-selected:bg-yellow-100 aria-selected:text-black",
                  isDarkMode ? "aria-selected:bg-yellow-900/20 aria-selected:text-white" : ""
                ),
                day_hidden: "invisible",
              }}
            />

            {startDate && endDate && !selectedPeriod && (
              <div className="mt-4 pt-4 border-t">
                <Button
                  onClick={handleApplyCustomDates}
                  className="w-full bg-yellow-500 text-black hover:bg-yellow-600"
                >
                  Aplicar período personalizado
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
