import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

export function WhatsAppChatSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(8)].map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 p-3 rounded-lg border"
        >
          {/* Avatar Skeleton */}
          <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
          
          <div className="flex-1 min-w-0 space-y-2">
            {/* Name and Time Row */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-12" />
            </div>

            {/* Message Preview */}
            <Skeleton className="h-3 w-full" />
            
            {/* Tags Row */}
            <div className="flex gap-1">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
