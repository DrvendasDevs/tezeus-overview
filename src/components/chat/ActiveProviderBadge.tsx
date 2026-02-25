import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Zap, Radio } from 'lucide-react';
import { useWhatsAppProviders } from '@/hooks/useWhatsAppProviders';
import { cn } from '@/lib/utils';

interface ActiveProviderBadgeProps {
  workspaceId: string;
  className?: string;
}

export function ActiveProviderBadge({ workspaceId, className }: ActiveProviderBadgeProps) {
  const { providers, fetchProviders, isLoading } = useWhatsAppProviders(workspaceId);
  const [activeProvider, setActiveProvider] = useState<'evolution' | 'zapi' | null>(null);

  useEffect(() => {
    if (workspaceId) {
      fetchProviders();
    }
  }, [workspaceId]);

  useEffect(() => {
    const active = providers.find(p => p.is_active);
    if (active) {
      setActiveProvider(active.provider);
    } else {
      setActiveProvider(null);
    }
  }, [providers]);

  if (isLoading || !activeProvider) {
    return null;
  }

  const isEvolution = activeProvider === 'evolution';
  const providerName = isEvolution ? 'Evolution API' : 'Z-API';
  const providerColor = isEvolution ? 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary border-primary/20' : 'bg-accent/10 text-accent-foreground dark:bg-accent/20 dark:text-accent-foreground border-accent/20';

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant="outline" 
            className={cn(
              'gap-1.5 px-2.5 py-1 font-medium transition-all cursor-help',
              providerColor,
              className
            )}
          >
            <Radio className="h-3.5 w-3.5 animate-pulse" />
            {providerName}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-medium">Provedor WhatsApp Ativo</p>
            <p className="text-xs text-muted-foreground">
              Todas as mensagens estão sendo enviadas via {providerName}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
