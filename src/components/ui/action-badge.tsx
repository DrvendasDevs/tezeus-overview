import React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getActionDisplayInfo } from "@/lib/action-parser";

interface ActionBadgeProps {
  actionText: string;
  onRemove?: () => void;
  className?: string;
  showRemoveButton?: boolean;
}

export function ActionBadge({ 
  actionText, 
  onRemove, 
  className,
  showRemoveButton = true 
}: ActionBadgeProps) {
  const actionInfo = getActionDisplayInfo(actionText);

  if (!actionInfo) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border",
        "select-none transition-all duration-200",
        actionInfo.color,
        className
      )}
      contentEditable={false}
      data-action={actionText}
      aria-label={`Ação: ${actionInfo.label}`}
    >
      <span className="flex-shrink-0">
        {actionInfo.icon}
      </span>
      <span className="truncate max-w-[200px]">
        {actionInfo.label}
      </span>
      {showRemoveButton && onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className={cn(
            "ml-0.5 rounded-full p-0.5 transition-colors",
            "hover:bg-black/10 dark:hover:bg-white/10",
            "focus:outline-none focus:ring-2 focus:ring-offset-1",
            "opacity-70 hover:opacity-100"
          )}
          aria-label="Remover ação"
          tabIndex={-1}
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </span>
  );
}



