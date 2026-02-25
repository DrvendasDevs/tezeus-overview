import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { WalletModal } from "./modals/WalletModal";
import { WorkspaceSelector } from "./WorkspaceSelector";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/contexts/WorkspaceContext";

interface TopBarProps {
  onNavigateToConversation?: (conversationId: string) => void;
}

export function TopBar({ onNavigateToConversation }: TopBarProps) {
  const [showWalletModal, setShowWalletModal] = useState(false);
  const { userRole } = useAuth();
  const { selectedWorkspace, setSelectedWorkspace } = useWorkspace();
  const navigate = useNavigate();

  const handleBackToMasterDashboard = () => {
    // Limpar workspace selecionado
    setSelectedWorkspace(null);
    localStorage.removeItem('selectedWorkspace');
    // Redirecionar para dashboard master
    navigate('/master-dashboard');
  };

  // Verificar se deve mostrar o botão de voltar (master e support)
  const showBackButton = (userRole === 'master' || userRole === 'support') && selectedWorkspace;

  return (
    <>
      <div className="flex gap-2 mx-4 mt-4 mb-4">
        {/* Botão de Voltar para Central Tezeus (apenas para usuário interno) */}
        {showBackButton && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackToMasterDashboard}
              className="flex items-center gap-2 hover:bg-primary hover:text-primary-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden md:inline">Central Tezeus</span>
              <Home className="h-4 w-4 md:hidden" />
            </Button>
            <div className="h-8 w-px bg-border" />
          </div>
        )}

        {/* Workspace Selector */}
        <div className="flex items-center">
          <WorkspaceSelector />
        </div>
        
        {/* Welcome Card */}
        <Card className="flex-1 relative overflow-hidden">
          <div 
            className="absolute right-0 top-0 w-1/2 h-full bg-cover bg-center bg-no-repeat opacity-100"
            style={{
              backgroundImage: "url('/lovable-uploads/0350fce5-76d3-4f93-a3d4-7a28486539b9.png')",
              filter: 'brightness(0.7)'
            }}
          />
          <CardContent className="p-6 relative z-10">
            {userRole !== 'master' ? (
              <>
                <p className="text-xs font-semibold mb-2 text-foreground">
                  Bem Vindo
                </p>
                <h3 className="text-xl font-semibold mb-1 text-foreground">
                  CDE - Centro de Desenvolvimento Empresarial
                </h3>
                <p className="text-xs text-muted-foreground">
                  Aqui estão algumas estatísticas da sua empresa
                </p>
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Home className="h-4 w-4" />
                <span>Acessando empresas como usuário Tezeus</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Wallet Card */}
        <Card className="flex-1">
          <CardHeader>
            <CardTitle className="text-xl text-foreground">
              Minha carteira
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div 
              className="flex items-center justify-between bg-muted p-4 rounded-lg"
            >
              <div className="text-2xl font-bold text-foreground">
                R$ 0
              </div>
              <Button 
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => setShowWalletModal(true)}
              >
                Adicionar Saldo
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <WalletModal 
        open={showWalletModal} 
        onOpenChange={setShowWalletModal} 
      />
    </>
  );
}