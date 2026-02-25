import { Button } from "@/components/ui/button";
import { X, ArrowRight } from "lucide-react";

interface MessageSelectionBarProps {
  selectedCount: number;
  onCancel: () => void;
  onForward: () => void;
}

export function MessageSelectionBar({ selectedCount, onCancel, onForward }: MessageSelectionBarProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gray-700 text-white p-3 flex items-center justify-between shadow-lg z-50">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          className="text-white hover:text-white hover:bg-white/10"
        >
          <X className="h-5 w-5" />
        </Button>
        <span className="font-medium">
          {selectedCount} {selectedCount === 1 ? 'selecionada' : 'selecionadas'}
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onForward}
        className="text-white hover:text-white hover:bg-white/10"
        disabled={selectedCount === 0}
      >
        <ArrowRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
