import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ColorPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onColorSelect: (color: string) => void;
  isDarkMode?: boolean;
}

export function ColorPickerModal({ open, onOpenChange, onColorSelect, isDarkMode = false }: ColorPickerModalProps) {
  const [selectedColor, setSelectedColor] = useState("#ff0000");
  const [pickerPosition, setPickerPosition] = useState<{ x: number; y: number } | null>(null);
  const [huePosition, setHuePosition] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hueCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (open) {
      // Timeout para garantir que o canvas esteja renderizado
      setTimeout(() => {
        drawColorPicker();
        drawHueBar();
      }, 100);
    }
  }, [open]);

  const drawColorPicker = (hueColor = "#ff0000") => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Create saturation gradient (white to hue color)
    const horizontalGradient = ctx.createLinearGradient(0, 0, width, 0);
    horizontalGradient.addColorStop(0, 'white');
    horizontalGradient.addColorStop(1, hueColor);

    ctx.fillStyle = horizontalGradient;
    ctx.fillRect(0, 0, width, height);

    // Create brightness gradient (transparent to black)
    const verticalGradient = ctx.createLinearGradient(0, 0, 0, height);
    verticalGradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    verticalGradient.addColorStop(1, 'rgba(0, 0, 0, 1)');

    ctx.fillStyle = verticalGradient;
    ctx.fillRect(0, 0, width, height);
  };

  const drawHueBar = () => {
    const canvas = hueCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, '#ff0000');
    gradient.addColorStop(0.17, '#ff8800');
    gradient.addColorStop(0.33, '#ffff00');
    gradient.addColorStop(0.5, '#00ff00');
    gradient.addColorStop(0.67, '#00ffff');
    gradient.addColorStop(0.83, '#0088ff');
    gradient.addColorStop(1, '#ff00ff');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  };

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;

    // Armazena a posição do clique
    setPickerPosition({ x, y });

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const imageData = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1);
      const [r, g, b] = imageData.data;
      
      const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      setSelectedColor(color);
    } catch (error) {
      console.error('Erro ao capturar cor:', error);
    }
  };

  const handleHueClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = hueCanvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const x = (event.clientX - rect.left) * scaleX;

    // Armazena a posição do clique no hue bar
    setHuePosition(x);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    try {
      const imageData = ctx.getImageData(Math.floor(x), 10, 1, 1);
      const [r, g, b] = imageData.data;
      
      const hueColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      
      // Redesenha o picker principal com a nova cor
      drawColorPicker(hueColor);
    } catch (error) {
      console.error('Erro ao capturar cor do hue:', error);
    }
  };

  const handleConfirm = () => {
    // Convert HSL to hex before returning
    const hslToHex = (hsl: string): string => {
      const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      if (!match) return selectedColor;
      
      const [, h, s, l] = match.map(Number);
      const sNorm = s / 100;
      const lNorm = l / 100;
      
      const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
      const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
      const m = lNorm - c / 2;
      
      let r, g, b;
      if (h < 60) {
        [r, g, b] = [c, x, 0];
      } else if (h < 120) {
        [r, g, b] = [x, c, 0];
      } else if (h < 180) {
        [r, g, b] = [0, c, x];
      } else if (h < 240) {
        [r, g, b] = [0, x, c];
      } else if (h < 300) {
        [r, g, b] = [x, 0, c];
      } else {
        [r, g, b] = [c, 0, x];
      }
      
      const toHex = (n: number) => {
        const hex = Math.round((n + m) * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
      };
      
      return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    };

    const hexColor = selectedColor.startsWith('#') ? selectedColor : hslToHex(selectedColor);
    onColorSelect(hexColor);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`sm:max-w-md ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700 text-gray-100' : 'bg-white text-gray-900'}`}>
        <DialogHeader className={`${isDarkMode ? 'bg-[#111111] border-b border-gray-700' : 'bg-transparent border-b border-gray-200'} px-6 pt-4 pb-3`}>
          <DialogTitle className={`${isDarkMode ? 'text-white' : 'text-gray-900'} text-base font-semibold`}>
            Escolha uma cor
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Main color picker */}
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={300}
              height={200}
              style={{ width: '100%', height: '200px' }}
              className="border border-gray-300 rounded cursor-crosshair"
              onClick={handleCanvasClick}
            />
            {/* Indicador de posição no picker */}
            {pickerPosition && (
              <div
                className="absolute w-4 h-4 border-2 border-white rounded-full pointer-events-none"
                style={{
                  left: `${(pickerPosition.x / 300) * 100}%`,
                  top: `${(pickerPosition.y / 200) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
                }}
              />
            )}
          </div>
          
          {/* Hue bar */}
          <div className="relative">
            <canvas
              ref={hueCanvasRef}
              width={300}
              height={20}
              style={{ width: '100%', height: '20px' }}
              className="border border-gray-300 rounded cursor-crosshair"
              onClick={handleHueClick}
            />
            {/* Indicador de posição no hue bar */}
            {huePosition !== null && (
              <div
                className="absolute w-1 h-full bg-white pointer-events-none"
                style={{
                  left: `${(huePosition / 300) * 100}%`,
                  transform: 'translateX(-50%)',
                  boxShadow: '0 0 0 1px rgba(0,0,0,0.5)',
                }}
              />
            )}
          </div>
          
          {/* Selected color preview */}
          <div className="flex items-center gap-2">
            <div 
              className={`w-8 h-8 border rounded ${isDarkMode ? 'border-gray-600' : 'border-gray-300'}`}
              style={{ backgroundColor: selectedColor }}
            />
            <span className={`text-sm ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
              {selectedColor}
            </span>
          </div>
          
          <div className={`flex justify-end gap-2 pt-4 border-t mt-4 -mx-6 -mb-6 p-4 ${isDarkMode ? 'bg-[#0f0f0f] border-gray-700' : 'bg-gray-50 border-[#d4d4d4]'}`}>
            <Button 
              variant="outline"
              onClick={() => onOpenChange(false)}
              className={`h-8 text-xs rounded-none ${isDarkMode ? 'border-gray-700 bg-[#1b1b1b] hover:bg-[#2a2a2a] text-gray-200' : 'border-gray-300 bg-white hover:bg-gray-100 text-gray-700'}`}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleConfirm}
              className={`h-8 text-xs rounded-none bg-primary hover:bg-primary/90 text-primary-foreground`}
            >
              Concluir
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}