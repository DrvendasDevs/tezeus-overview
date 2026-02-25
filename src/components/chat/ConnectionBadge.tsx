import { Smartphone } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ConnectionInfo {
  instance_name: string;
  phone_number?: string;
  status: string;
}

interface ConnectionBadgeProps {
  connectionId?: string;
  connectionInfo?: {
    instance_name: string;
    phone_number?: string;
    status: string;
  };
}

export function ConnectionBadge({ connectionId, connectionInfo: propConnectionInfo }: ConnectionBadgeProps) {
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo | null>(propConnectionInfo || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Se já tem dados via props, não busca nada
    if (propConnectionInfo) {
      setConnectionInfo(propConnectionInfo);
      return;
    }

    // Fallback: busca apenas se não tiver dados
    if (!connectionId) {
      return;
    }

    const fetchConnectionInfo = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('connections')
          .select('instance_name, phone_number, status')
          .eq('id', connectionId)
          .single();

        if (error) throw error;
        setConnectionInfo(data);
      } catch (error) {
        console.error('Error fetching connection info:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchConnectionInfo();
  }, [connectionId, propConnectionInfo]);

  if (loading) {
    return (
      <Badge variant="outline" className="flex items-center gap-1 h-5 px-1.5 opacity-50">
        <Smartphone className="w-3 h-3 animate-pulse" />
      </Badge>
    );
  }

  if (!connectionInfo) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
      case 'connected':
        return 'bg-success/10 text-success dark:text-success';
      case 'creating':
      case 'connecting':
        return 'bg-warning/10 text-warning dark:text-warning';
      case 'closed':
      case 'disconnected':
        return 'bg-destructive/10 text-destructive dark:text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'open':
      case 'connected':
        return 'Conectado';
      case 'creating':
        return 'Criando';
      case 'connecting':
        return 'Conectando';
      case 'closed':
      case 'disconnected':
        return 'Desconectado';
      default:
        return status;
    }
  };

  return (
    <Tooltip delayDuration={100}>
      <TooltipTrigger asChild>
        <Badge 
          variant="outline" 
          className="flex items-center gap-1 h-5 px-1.5 cursor-pointer hover:bg-muted transition-colors max-w-[90px]"
        >
          <Smartphone className="w-3 h-3 flex-shrink-0" />
          <span className="text-[10px] font-medium truncate">
            {connectionInfo?.instance_name}
          </span>
        </Badge>
      </TooltipTrigger>
      <TooltipPrimitive.Portal>
        <TooltipContent side="top" className="max-w-xs z-[9999] bg-white text-gray-900 border border-gray-200 shadow-lg dark:bg-[#050505] dark:text-gray-100 dark:border-gray-700" sideOffset={8}>
          <div className="space-y-2">
            <div>
              <p className="text-xs font-semibold dark:text-gray-100">Instância WhatsApp</p>
              <p className="text-xs text-muted-foreground mt-0.5 dark:text-gray-400">
                {connectionInfo?.instance_name || 'N/A'}
              </p>
            </div>
            {connectionInfo?.phone_number && (
              <div>
                <p className="text-xs font-semibold dark:text-gray-100">Número</p>
                <p className="text-xs text-muted-foreground mt-0.5 dark:text-gray-400">
                  {connectionInfo.phone_number}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs font-semibold dark:text-gray-100">Status</p>
              <Badge 
                variant="outline" 
                className={`mt-1 text-[10px] ${getStatusColor(connectionInfo?.status || '')} bg-white dark:bg-transparent`}
              >
                {getStatusLabel(connectionInfo?.status || '')}
              </Badge>
            </div>
          </div>
        </TooltipContent>
      </TooltipPrimitive.Portal>
    </Tooltip>
  );
}
