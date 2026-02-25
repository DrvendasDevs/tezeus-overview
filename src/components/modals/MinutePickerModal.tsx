import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface MinutePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMinuteSelect: (minute: number) => void;
  selectedMinute?: number | null;
  isDarkMode?: boolean;
}

export const MinutePickerModal: React.FC<MinutePickerModalProps> = ({
  isOpen,
  onClose,
  onMinuteSelect,
  selectedMinute = null,
  isDarkMode = false,
}) => {
  const [currentMinute, setCurrentMinute] = React.useState<number | null>(
    selectedMinute !== null && selectedMinute !== undefined ? selectedMinute : new Date().getMinutes()
  );

  React.useEffect(() => {
    if (isOpen) {
      const initialMinute = selectedMinute ?? null;
      setCurrentMinute(
        initialMinute !== null && initialMinute !== undefined
          ? initialMinute
          : new Date().getMinutes()
      );
    } else {
      setCurrentMinute(
        selectedMinute !== null && selectedMinute !== undefined
          ? selectedMinute
          : new Date().getMinutes()
      );
    }
  }, [isOpen, selectedMinute]);

  const clampMinute = (minute: number) => {
    if (Number.isNaN(minute)) return null;
    if (minute < 0) return 0;
    if (minute > 59) return 59;
    return minute;
  };

  const handleInputChange = (value: string) => {
    if (value === '') {
      setCurrentMinute(null);
      return;
    }
    const parsed = parseInt(value, 10);
    const clamped = clampMinute(parsed);
    setCurrentMinute(clamped);
  };

  const handleIncrement = () => {
    setCurrentMinute((prev) => {
      if (prev === null) return 0;
      return prev === 59 ? 0 : prev + 1;
    });
  };

  const handleDecrement = () => {
    setCurrentMinute((prev) => {
      if (prev === null) return 59;
      return prev === 0 ? 59 : prev - 1;
    });
  };

  const handleSliderChange = (value: string) => {
    setCurrentMinute(Number(value));
  };

  const handleConfirm = () => {
    if (currentMinute !== null) {
      onMinuteSelect(currentMinute);
    }
    onClose();
  };

  const displayMinute = currentMinute !== null
    ? currentMinute.toString().padStart(2, '0')
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
            Selecionar Minutos
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-6 p-4">
          {/* Display digital */}
          <div className="flex items-center gap-4">
            <div className={cn(
              "rounded-lg px-6 py-4 text-6xl font-mono tracking-widest shadow-inner",
              isDarkMode ? "bg-gray-900 text-yellow-300" : "bg-gray-100 text-blue-600"
            )}>
              {displayMinute}
              <span className="text-4xl align-baseline ml-1 text-current">min</span>
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
              Ajustar minutos manualmente
            </label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={0}
                max={59}
                value={currentMinute ?? ''}
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
                Informe minutos entre 0 e 59.
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={59}
              value={currentMinute ?? 0}
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
              disabled={currentMinute === null}
            >
              OK
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};