import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuickFunnels } from "@/hooks/useQuickFunnels";
import { ListFilter, Loader2 } from "lucide-react";

interface FunnelSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFunnelSelected: (funnelId: string, funnelTitle: string) => void;
  workspaceId?: string;
}

export function FunnelSelectorModal({
  open,
  onOpenChange,
  onFunnelSelected,
  workspaceId,
}: FunnelSelectorModalProps) {
  const { funnels, loading } = useQuickFunnels(workspaceId);

  const handleSelect = (funnelId: string, funnelTitle: string) => {
    onFunnelSelected(funnelId, funnelTitle);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-white text-gray-900 border border-[#d4d4d4] dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
        <DialogHeader className="border-b border-[#e5e5e5] pb-2 mb-4 dark:border-gray-800">
          <DialogTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <ListFilter className="w-5 h-5" />
            Selecionar Funil
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground dark:text-gray-400" />
          </div>
        ) : funnels.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground dark:text-gray-400">
            Nenhum funil encontrado. Crie um funil primeiro para poder usá-lo.
          </div>
        ) : (
          <ScrollArea className="max-h-[400px] pr-4">
            <div className="space-y-2">
              {funnels.map((funnel) => (
                <Button
                  key={funnel.id}
                  variant="outline"
                  className="w-full justify-start h-auto py-3 px-4 rounded-none border border-[#d4d4d4] hover:bg-accent/30 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-[#1a1a1a]"
                  onClick={() => handleSelect(funnel.id, funnel.title)}
                >
                  <div className="flex flex-col items-start gap-1 w-full">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{funnel.title}</span>
                    <span className="text-xs text-muted-foreground dark:text-gray-400">
                      {funnel.steps?.length || 0} {funnel.steps?.length === 1 ? 'etapa' : 'etapas'}
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
