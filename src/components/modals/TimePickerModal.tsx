import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface TimePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTimeSelect: (hour: number) => void;
  selectedHour?: number | null;
  isDarkMode?: boolean;
}

export const TimePickerModal: React.FC<TimePickerModalProps> = ({
  isOpen,
  onClose,
  onTimeSelect,
  selectedHour = null,
  isDarkMode = false,
}) => {
  const [currentHour, setCurrentHour] = React.useState<number | null>(
    selectedHour !== null && selectedHour !== undefined ? selectedHour : new Date().getHours()
  );

  React.useEffect(() => {
    if (isOpen) {
      const initialHour = selectedHour ?? null;
      setCurrentHour(
        initialHour !== null && initialHour !== undefined
          ? initialHour
          : new Date().getHours()
      );
    } else {
      setCurrentHour(
        selectedHour !== null && selectedHour !== undefined
          ? selectedHour
          : new Date().getHours()
      );
    }
  }, [isOpen, selectedHour]);

  const clampHour = (hour: number) => {
    if (Number.isNaN(hour)) return null;
    if (hour < 0) return 0;
    if (hour > 23) return 23;
    return hour;
  };

  const handleInputChange = (value: string) => {
    if (value === '') {
      setCurrentHour(null);
      return;
    }

    const parsed = parseInt(value, 10);
    const clamped = clampHour(parsed);
    setCurrentHour(clamped);
  };

  const handleIncrement = () => {
    setCurrentHour((prev) => {
      if (prev === null) return 0;
      return prev === 23 ? 0 : prev + 1;
    });
  };

  const handleDecrement = () => {
    setCurrentHour((prev) => {
      if (prev === null) return 23;
      return prev === 0 ? 23 : prev - 1;
    });
  };

  const handleSliderChange = (value: string) => {
    setCurrentHour(Number(value));
  };

  const handleConfirm = () => {
    if (currentHour !== null) {
      onTimeSelect(currentHour);
    }
    onClose();
  };

  const displayHour = currentHour !== null
    ? currentHour.toString().padStart(2, '0')
    : '--';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) {
        onClose();
      }
    }}>
      <DialogContent className={cn(
        "sm:max-w-md",
        isDarkMode ? "bg-[#1a1a1a] border-gray-700" : "bg-white"
      )}>
        <DialogHeader>
          <DialogTitle className={cn(
            "text-center",
            isDarkMode ? "text-white" : "text-gray-900"
          )}>
            Selecionar Hora
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-6 p-4">
          {/* Display digital */}
          <div className="flex items-center gap-4">
            <div className={cn(
              "rounded-lg px-6 py-4 text-6xl font-mono tracking-widest shadow-inner",
              isDarkMode ? "bg-gray-900 text-yellow-300" : "bg-gray-100 text-blue-600"
            )}>
              {displayHour}
              <span className="text-4xl align-baseline ml-1 text-current">h</span>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                onClick={handleIncrement}
                className={cn(
                  "w-16",
                  isDarkMode ? "border-gray-700 text-gray-200 hover:bg-gray-800" : "text-gray-700"
                )}
              >
                +1
              </Button>
              <Button
                variant="outline"
                onClick={handleDecrement}
                className={cn(
                  "w-16",
                  isDarkMode ? "border-gray-700 text-gray-200 hover:bg-gray-800" : "text-gray-700"
                )}
              >
                -1
              </Button>
            </div>
          </div>

          <div className="w-full space-y-3">
            <label className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-gray-300" : "text-gray-700"
            )}>
              Ajustar horário manualmente
            </label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                max={23}
                value={currentHour ?? ''}
                onChange={(event) => handleInputChange(event.target.value)}
                className={cn(
                  "w-24 text-center text-2xl font-mono",
                  isDarkMode ? "bg-gray-900 border-gray-700 text-gray-100" : "text-gray-900"
                )}
              />
              <span className={cn(
                "text-sm",
                isDarkMode ? "text-gray-400" : "text-gray-500"
              )}>
                Informe uma hora entre 0 e 23.
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={23}
              value={currentHour ?? 0}
              onChange={(event) => handleSliderChange(event.target.value)}
              className="w-full"
            />
          </div>

          {/* Botões de ação */}
          <div className="flex space-x-4">
            <Button
              variant="ghost"
              onClick={() => onClose()}
              className={cn(
                isDarkMode ? "text-gray-300 hover:bg-gray-800" : "text-gray-700 hover:bg-gray-100"
              )}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              className="bg-yellow-400 hover:bg-yellow-500 text-gray-900"
              disabled={currentHour === null}
            >
              OK
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};