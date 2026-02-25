import React from 'react';
import * as LucideIcons from "lucide-react";
import { LucideIcon } from "lucide-react";
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

export interface TimelineColumn {
  id: string;
  name: string;
  color: string;
  icon?: string;
  isActive: boolean;
}

interface PipelineTimelineProps {
  columns: TimelineColumn[];
  currentColumnId?: string;
  className?: string;
  onStepClick?: (columnId: string) => void;
  isDarkMode?: boolean;
}

export function PipelineTimeline({ columns, currentColumnId, className, onStepClick, isDarkMode = false }: PipelineTimelineProps) {
  const currentIndex = columns.findIndex(col => col.id === currentColumnId);

  console.log('🎨 Timeline renderizada com colunas:', columns.map(c => ({ 
    id: c.id, 
    name: c.name, 
    icon: c.icon,
    color: c.color 
  })));

  return (
    <div className={cn("flex items-center justify-between w-full py-8 px-4 min-w-max", className)}>
      {columns.map((column, index) => {
        const IconComponent = (column.icon && LucideIcons[column.icon as keyof typeof LucideIcons]) as LucideIcon;
        const Icon = IconComponent || LucideIcons.Circle;
        
        const isPast = currentIndex !== -1 && index < currentIndex;
        const isCurrent = index === currentIndex;
        const isFuture = currentIndex !== -1 ? index > currentIndex : true;
        const futureOpacity = isFuture ? (currentIndex === -1 ? 0.6 : 0.85 - Math.min(index - currentIndex, 3) * 0.1) : 1;
        
        // Determina o gradiente da linha baseado nos estados
        const nextColumn = columns[index + 1];
        let lineClass = '';
        let lineStyle: React.CSSProperties = {};
        
        if (index < columns.length - 1) {
          const nextIndex = index + 1;
          const isNextPast = currentIndex !== -1 && nextIndex < currentIndex;
          const isNextCurrent = nextIndex === currentIndex;
          
          if (isPast && isNextPast) {
            // Ambos completados - linha sólida escura
            lineStyle = { background: 'hsl(var(--muted-foreground))' };
          } else if (isPast && isNextCurrent) {
            // De completado para atual - gradiente para verde
            lineStyle = { background: `linear-gradient(to right, hsl(var(--muted-foreground)), ${column.color})` };
          } else if (isCurrent && !isNextPast) {
            // De atual para futuro - gradiente para cinza
            lineStyle = { background: `linear-gradient(to right, ${column.color}, hsl(var(--border)))` };
          } else {
            // Linha padrão cinza
            lineStyle = { background: 'hsl(var(--border))' };
          }
        }

        return (
          <div key={column.id} className="contents">
            <div 
              className={cn("flex flex-col items-center relative group flex-shrink-0", onStepClick && "cursor-pointer")} 
                style={{ minWidth: '120px', maxWidth: '200px' }}
              onClick={() => onStepClick?.(column.id)}
            >
              {/* Ícone grande acima */}
              <div 
                className={cn(
                  "absolute -top-10 transition-all duration-200",
                  isCurrent && "scale-110"
                )}
                style={{
                  color: isPast || isCurrent ? (isPast ? 'hsl(var(--muted-foreground))' : column.color) : `hsl(var(--muted))`,
                  opacity: isFuture ? futureOpacity : 1
                }}
              >
                <Icon className="h-6 w-6" strokeWidth={2} />
              </div>
              
              {/* Círculo do step */}
              <div className="relative flex items-center justify-center">
                {isPast && (
                  // Step completado com checkmark
                  <div
                    className="w-[18px] h-[18px] rounded-full flex items-center justify-center transition-all duration-200"
                    style={{ backgroundColor: 'hsl(var(--muted-foreground))' }}
                  >
                    <LucideIcons.Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                  </div>
                )}
                
                {isCurrent && (
                  // Step atual com loading spinner
                  <div
                    className="w-[18px] h-[18px] rounded-full flex items-center justify-center transition-all duration-200 shadow-md"
                    style={{ backgroundColor: column.color }}
                  >
                    <Loader2 className="h-2.5 w-2.5 text-white animate-spin" strokeWidth={3} />
                  </div>
                )}
                
                {isFuture && (
                  // Step futuro - círculo vazio com borda
                  <div
                    className="w-[15px] h-[15px] rounded-full transition-all duration-200 group-hover:border-gray-400"
                    style={{ 
                      border: `3px solid rgba(148, 163, 184, ${futureOpacity})`,
                      backgroundColor: 'transparent'
                    }}
                  />
                )}
              </div>

              {/* Label abaixo */}
              <span
                className={cn(
                  "absolute top-6 text-[10px] font-medium text-center transition-all duration-200",
                  isPast && (isDarkMode ? "text-gray-400" : "text-muted-foreground"),
                  isFuture && (isDarkMode ? "text-gray-500" : "text-muted"),
                  isCurrent && "font-bold"
                )}
                style={{
                  ...(isCurrent ? { color: column.color } : isFuture ? { opacity: futureOpacity } : {}),
                  maxWidth: '120px',
                  wordBreak: 'break-word',
                  lineHeight: '1.2'
                }}
              >
                {column.name}
              </span>
            </div>

            {/* Linha conectora com gradientes */}
            {index < columns.length - 1 && (
              <div 
                className="h-0.5 transition-all duration-200 flex-shrink-0" 
                style={{ 
                  flexGrow: 1,
                  minWidth: '60px',
                  maxWidth: '120px',
                  ...lineStyle
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
