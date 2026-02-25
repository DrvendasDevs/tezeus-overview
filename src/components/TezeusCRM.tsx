import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { useSessionManager } from "@/hooks/useSessionManager";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useWorkspaceStatusCheck } from "@/hooks/useWorkspaceStatusCheck";
import { PipelinesProvider } from "@/contexts/PipelinesContext";
import { useWorkspaces } from "@/hooks/useWorkspaces";

import { Dashboard } from "./Dashboard";
import { Conversas } from "./modules/Conversas";
import { DSVoice } from "./modules/DSVoice";
import { CRMNegocios } from "./modules/CRMNegocios";
import { CRMAtividades } from "./modules/CRMAtividades";
import { CRMAgenda } from "./modules/CRMAgenda";
import { CRMPanorama } from "./modules/CRMPanorama";

import { CRMContatos } from "./modules/CRMContatos";
import { CRMTags } from "./modules/CRMTags";
import { CRMProdutos } from "./modules/CRMProdutos";

import { DSAgente } from "./modules/DSAgente";
import { EditarAgente } from "./modules/EditarAgente";
import { AutomacoesBot } from "./modules/AutomacoesBot";
import { AutomacoesIntegracoes } from "./modules/AutomacoesIntegracoes";
import { AutomacoesFilas } from "./modules/AutomacoesFilas";
import { AutomacoesAPI } from "./modules/AutomacoesAPI";
import { Conexoes } from "./modules/Conexoes";
import { AdministracaoUsuarios } from "./modules/AdministracaoUsuarios";
import { AdministracaoFinanceiro } from "./modules/AdministracaoFinanceiro";
import { AdministracaoConfiguracoes } from "./modules/AdministracaoConfiguracoes";
import { AdministracaoDashboard } from "./modules/AdministracaoDashboard";
import { AdministracaoGoogleAgenda } from "./modules/AdministracaoGoogleAgenda";
import { ConfiguracaoAcoes } from "./modules/ConfiguracaoAcoes";
import { ParceirosClientes } from "./modules/ParceirosClientes";
import { WorkspaceEmpresas } from "./modules/WorkspaceEmpresas";
import { WorkspaceUsersPage } from "./modules/WorkspaceUsersPage";
import { WorkspaceApiKeys } from "./modules/WorkspaceApiKeys";
import { DealDetailsPage } from "@/pages/DealDetailsPage";
import { RelatoriosAvancados } from "@/components/relatorios-avancados/RelatoriosAvancados";
import { Disparador } from "./modules/Disparador";

export type ModuleType = 
  | "relatorios"
  | "conversas"
  | "disparador"
  | "mensagens-rapidas"
  | "pipeline"
  | "panorama"
  | "pipeline-detail"
  | "atividades"
  | "agendas"
  | "contatos"
  | "etiquetas"
  | "produtos"
  
  | "automacoes-agente"
  | "automacoes-bot"
  | "automacoes-integracoes"
  | "filas"
  | "automacoes-api"
  | "automacoes-webhooks"
  | "conexoes"
  | "empresa"
  | "workspace-usuarios"
  | "workspace-api-keys"
  | "workspace-relatorios"
  | "parceiros-clientes"
  | "administracao-usuarios"
  | "administracao-financeiro"
  | "administracao-configuracoes"
  | "administracao-dashboard"
  | "administracao-google-agenda"
  | "configuracao-acoes"
  | "editar-agente";

export function TezeusCRM() {
  // Monitor de sessão global
  useSessionManager();
  
  // Monitorar status do workspace
  useWorkspaceStatusCheck();
  // Garantir que a lista de workspaces seja carregada assim que o CRM abrir
  useWorkspaces();
  
  const location = useLocation();
  const navigate = useNavigate();
  const params = useParams();
  const { userRole } = useAuth();
  const { selectedWorkspace } = useWorkspace();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  // Helper para construir rotas baseado no role
  const getRoutePath = (path: string) => {
    // Remover barra inicial se houver
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    
    if (userRole === 'master' && selectedWorkspace) {
      return `/workspace/${selectedWorkspace.workspace_id}${cleanPath}`;
    }
    return cleanPath;
  };

  // Convert URL path to module type
  const getModuleFromPath = (pathname: string): ModuleType => {
    // Remover prefixo /workspace/:workspaceId se existir
    let path = pathname;
    const workspaceMatch = pathname.match(/^\/workspace\/[^/]+\/(.+)/);
    if (workspaceMatch) {
      path = `/${workspaceMatch[1]}`;
    }
    
    // Normalizar o path removendo a primeira barra
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    const pathParts = cleanPath.split("/");
    
    // 1. Verificar se é a página de detalhes do negócio (prioridade alta)
    // Suporta /pipeline/:id ou /crm-negocios/:id
    if ((pathParts[0] === "pipeline" || pathParts[0] === "crm-negocios") && pathParts.length > 1 && pathParts[1]) {
      return "pipeline-detail";
    }
    
    // 2. Mapeamento de legados e nomes amigáveis
    if (cleanPath === "" || cleanPath === "relatorios" || cleanPath === "dashboard") return "relatorios";
    if (cleanPath.startsWith("editar-agente/")) return "editar-agente";
    if (cleanPath.includes("/usuarios")) return "workspace-usuarios";
    
    // Mapeamento direto
    if (cleanPath === "crm-negocios" || cleanPath === "pipeline") return "pipeline";
    if (cleanPath === "panorama") return "panorama";
    if (cleanPath === "crm-atividades" || cleanPath === "atividades") return "atividades";
    if (cleanPath === "crm-agenda" || cleanPath === "agendas") return "agendas";
    if (cleanPath === "crm-contatos" || cleanPath === "contatos") return "contatos";
    if (cleanPath === "crm-tags" || cleanPath === "etiquetas") return "etiquetas";
    if (cleanPath === "crm-produtos" || cleanPath === "produtos") return "produtos";
    if (cleanPath === "ds-voice" || cleanPath === "mensagens-rapidas") return "mensagens-rapidas";
    if (cleanPath === "disparador") return "disparador";
    if (cleanPath === "workspace-empresas" || cleanPath === "empresa") return "empresa";
    if (cleanPath === "automacoes-filas" || cleanPath === "filas") return "filas";
    if (cleanPath === "administracao-acoes" || cleanPath === "configuracao-acoes") return "configuracao-acoes";
    
    return cleanPath as ModuleType;
  };

  const activeModule = getModuleFromPath(location.pathname);
  const editingAgentId = params.agentId || null;

  // Handle conversation selection from location state (notificações)
  useEffect(() => {
    const conversationIdFromState = (location.state as any)?.selectedConversationId;
    
    if (conversationIdFromState && conversationIdFromState !== selectedConversationId) {
      setSelectedConversationId(conversationIdFromState);
      
      // ✅ Limpar o state após processar para permitir navegação livre
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, selectedConversationId, navigate, location.pathname]);

  // Listener para navegação via toast
  useEffect(() => {
    const handleNavigateToConversation = (event: CustomEvent) => {
      const conversationId = event.detail;
      setSelectedConversationId(conversationId);
      navigate(getRoutePath('/conversas'));
    };

    window.addEventListener('navigate-to-conversation', handleNavigateToConversation as EventListener);
    return () => {
      window.removeEventListener('navigate-to-conversation', handleNavigateToConversation as EventListener);
    };
  }, [navigate, userRole, selectedWorkspace]);

  const renderModule = () => {
    switch (activeModule) {
      case "relatorios":
      case "workspace-relatorios":
        return <RelatoriosAvancados />;
      case "dashboard":
        return <Dashboard />;
      case "conversas":
        return <Conversas selectedConversationId={selectedConversationId} />;
      case "disparador":
        return <Disparador />;
      case "mensagens-rapidas":
        return <DSVoice />;
      case "pipeline":
        return <CRMNegocios onCollapseSidebar={() => setIsCollapsed(true)} />;
      case "panorama":
        return <CRMPanorama />;
      case "pipeline-detail":
        return <DealDetailsPage />;
      case "atividades":
        return <CRMAtividades />;
      case "agendas":
        return <CRMAgenda />;
      case "contatos":
        return <CRMContatos />;
      case "etiquetas":
        return <CRMTags />;
      case "produtos":
        return <CRMProdutos />;
      case "automacoes-agente":
        return <DSAgente />;
      case "automacoes-bot":
        return <AutomacoesBot />;
      case "automacoes-integracoes":
        return <AutomacoesIntegracoes />;
      case "filas":
        return <AutomacoesFilas />;
      case "automacoes-api":
        return <AutomacoesAPI />;
      case "conexoes":
        return <Conexoes />;
      case "empresa":
        return <WorkspaceEmpresas />;
      case "workspace-usuarios":
        return <WorkspaceUsersPage />;
      case "workspace-api-keys":
        return <WorkspaceApiKeys />;
      
      case "parceiros-clientes":
        return <ParceirosClientes />;
      case "administracao-usuarios":
        return <AdministracaoUsuarios />;
      case "administracao-financeiro":
        return <AdministracaoFinanceiro />;
      case "administracao-configuracoes":
        return <AdministracaoConfiguracoes />;
      case "administracao-dashboard":
        return <AdministracaoDashboard />;
      case "administracao-google-agenda":
        return <AdministracaoGoogleAgenda />;
      case "configuracao-acoes":
        return <ConfiguracaoAcoes />;
      case "editar-agente":
        return editingAgentId ? <EditarAgente agentId={editingAgentId} /> : <Dashboard />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <PipelinesProvider>
      <div className="min-h-screen flex w-full gap-2 bg-gradient-to-br from-background via-background to-muted dark:bg-[#0f1115] dark:from-[#0f1115] dark:via-[#0f1115] dark:to-[#0f1115] transition-colors duration-300 ease-in-out">
        <Sidebar 
          activeModule={activeModule}
          onModuleChange={(module) => {
            if (module === 'editar-agente') {
              // Handle editar-agente navigation differently since it needs agentId
              return;
            }
            navigate(getRoutePath(`/${module === 'relatorios' ? 'relatorios' : module}`));
          }}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
          onNavigateToConversation={(conversationId) => {
            setSelectedConversationId(conversationId);
            
            // ✅ Usar rota correta baseada no role
            navigate(getRoutePath('/conversas'), { 
              state: { selectedConversationId: conversationId },
              replace: true 
            });
          }}
        />
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <main className={`flex-1 flex flex-col overflow-hidden ${activeModule === 'conversas' || activeModule === 'conexoes' ? 'bg-white border border-[#d4d4d4] shadow-sm rounded-none m-2 dark:bg-[#1f1f1f] dark:border-gray-700' : ''}`}>
            {renderModule()}
          </main>
        </div>
      </div>
    </PipelinesProvider>
  );
}