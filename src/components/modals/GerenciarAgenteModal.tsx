import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bot, Zap, ZapOff } from "lucide-react";


interface GerenciarAgenteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAgentActive: boolean;
  onToggleAgent: () => void;
}

export function GerenciarAgenteModal({
  open,
  onOpenChange,
  currentAgentActive,
  onToggleAgent,
}: GerenciarAgenteModalProps) {
  const handleToggleAgent = () => {
    onToggleAgent();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            Gerenciar Agente IA
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium">Agente Tezeus</h4>
              <Badge variant={currentAgentActive ? "default" : "secondary"}>
                {currentAgentActive ? "Ativo" : "Inativo"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Assistente inteligente para atendimento automatizado
            </p>
            
            <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/50">
              <div className={`w-3 h-3 rounded-full ${currentAgentActive ? 'bg-green-500' : 'bg-gray-400'}`} />
              <span className="text-sm font-medium">
                IA {currentAgentActive ? 'Ativa' : 'Inativa'}
              </span>
            </div>
          </div>

          <div className="text-center text-sm text-muted-foreground">
            <p>Para configurações avançadas do agente, acesse:</p>
            <p className="font-medium text-primary">Automações → Agentes de IA</p>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleToggleAgent}
            variant={currentAgentActive ? "destructive" : "default"}
            className="flex items-center gap-2"
          >
            {currentAgentActive ? (
              <>
                <ZapOff className="w-4 h-4" />
                Desativar IA
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Ativar IA
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

    </Dialog>
  );
}