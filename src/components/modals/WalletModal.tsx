import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Phone, MessageSquare, Wallet } from "lucide-react";
import { AddressModal } from "./AddressModal";

interface WalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletModal({ open, onOpenChange }: WalletModalProps) {
  const [showAddressModal, setShowAddressModal] = useState(false);

  const handleCreateWallet = () => {
    onOpenChange(false);
    setShowAddressModal(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Carteira Digital</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Steps indicator */}
            <div className="flex items-center justify-center gap-2">
              <div className="w-8 h-8 rounded-full bg-brand-yellow text-black flex items-center justify-center text-sm font-medium">1</div>
              <div className="w-8 border-t border-muted-foreground"></div>
              <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm">2</div>
              <div className="w-8 border-t border-muted-foreground"></div>
              <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm">3</div>
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">Sua carteira digital</h3>
              <p className="text-sm text-muted-foreground">
                Crie sua carteira digital para ter acesso a todos os recursos do sistema
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <Phone className="w-5 h-5 text-brand-blue" />
                <span className="text-sm">Realizar ligações Voip</span>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <MessageSquare className="w-5 h-5 text-brand-blue" />
                <span className="text-sm">Enviar SMS em massa</span>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg border">
                <Wallet className="w-5 h-5 text-brand-blue" />
                <span className="text-sm">Gerenciar seu saldo facilmente</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button 
                variant="yellow"
                className="flex-1"
                onClick={handleCreateWallet}
              >
                Criar Carteira Digital
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AddressModal 
        open={showAddressModal} 
        onOpenChange={setShowAddressModal} 
      />
    </>
  );
}