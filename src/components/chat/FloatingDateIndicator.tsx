import { cn } from '@/lib/utils';

interface FloatingDateIndicatorProps {
  date: string;
  visible: boolean;
}

export function FloatingDateIndicator({ date, visible }: FloatingDateIndicatorProps) {
  return (
    <div 
      className={cn(
        "absolute top-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ease-in-out",
        visible 
          ? "opacity-100 translate-y-0 animate-fade-in" 
          : "opacity-0 -translate-y-2 animate-fade-out pointer-events-none"
      )}
    >
      <div 
        className="bg-background/95 dark:bg-[#1f1f1f]/95 backdrop-blur-sm border border-border dark:border-gray-700 rounded-full px-4 py-1.5 shadow-lg dark:shadow-xl"
      >
        <span className="text-xs font-medium text-foreground dark:text-gray-200 capitalize">
          {date}
        </span>
      </div>
    </div>
  );
}
