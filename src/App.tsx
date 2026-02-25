import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { TezeusCRM } from "@/components/TezeusCRM";
import NotFound from "./pages/NotFound";
import { AuthProvider } from "./components/AuthProvider";
import { WorkspaceProvider } from "./contexts/WorkspaceContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { RoleProtectedRoute } from "./components/RoleProtectedRoute";
import { Login } from "./pages/Login";
import MasterDashboard from "./pages/MasterDashboard";
import TesteNotificacao from "./pages/TesteNotificacao";
import GoogleAgendaCallback from "./pages/GoogleAgendaCallback";
import { SystemCustomizationProvider } from "./contexts/SystemCustomizationContext";
import { RealtimeNotificationProvider } from "./components/RealtimeNotificationProvider";
import { ErrorBoundary } from "./components/ErrorBoundary";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <SystemCustomizationProvider>
          <WorkspaceProvider>
            <RealtimeNotificationProvider>
              <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/relatorios" replace />} />
            <Route path="/master-dashboard" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support']}>
                  <MasterDashboard />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            {/* ========== ROTAS MASTER/SUPPORT (via Visualizar Empresa) ========== */}
            <Route path="/workspace/:workspaceId/relatorios" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/conversas" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/disparador" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/mensagens-rapidas" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/pipeline" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/pipeline/:cardId" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/panorama" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/atividades" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/agendas" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/crm-ligacoes" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/contatos" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/etiquetas" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/produtos" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/automacoes-agente" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/automacoes-bot" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/automacoes-integracoes" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/filas" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/automacoes-api" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/parceiros-planos" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/empresa" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/relatorios" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/empresa/:workspaceId/usuarios" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/conexoes" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/administracao-usuarios" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/administracao-financeiro" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/administracao-configuracoes" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/administracao-dashboard" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/administracao-google-agenda" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/configuracao-acoes" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/workspace-api-keys" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/parceiros-clientes" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/workspace/:workspaceId/editar-agente/:agentId" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            
            {/* ========== ROTAS NORMAIS (Admin/User) ========== */}
            <Route path="/relatorios" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/conversas" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/disparador" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/mensagens-rapidas" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/pipeline" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/pipeline/:cardId" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/panorama" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/atividades" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/agendas" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/crm-ligacoes" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/contatos" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/etiquetas" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/produtos" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/automacoes-agente" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/automacoes-bot" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/automacoes-integracoes" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/filas" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/automacoes-api" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/parceiros-planos" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/editar-agente/:agentId" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            
            {/* Rotas que Master pode acessar diretamente */}
            <Route path="/conexoes" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/administracao-usuarios" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'admin']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/administracao-financeiro" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/administracao-configuracoes" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/administracao-dashboard" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/administracao-google-agenda" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/configuracao-acoes" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/empresa" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/empresa/:workspaceId/usuarios" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/parceiros-clientes" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support']}>
                  <TezeusCRM />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            <Route path="/teste-notificacao" element={
              <ProtectedRoute>
                <TesteNotificacao />
              </ProtectedRoute>
            } />
            <Route path="/google-agenda/callback" element={
              <ProtectedRoute>
                <RoleProtectedRoute allowedRoles={['master', 'support', 'admin', 'user']}>
                  <GoogleAgendaCallback />
                </RoleProtectedRoute>
              </ProtectedRoute>
            } />
            
            {/* Redirecionamentos de Legado */}
            <Route path="/dashboard" element={<Navigate to="/relatorios" replace />} />
            <Route path="/crm-negocios" element={<Navigate to="/pipeline" replace />} />
            <Route path="/crm-negocios/:cardId" element={<TezeusCRM />} />
            <Route path="/crm-atividades" element={<Navigate to="/atividades" replace />} />
            <Route path="/crm-agenda" element={<Navigate to="/agendas" replace />} />
            <Route path="/crm-contatos" element={<Navigate to="/contatos" replace />} />
            <Route path="/crm-tags" element={<Navigate to="/etiquetas" replace />} />
            <Route path="/crm-produtos" element={<Navigate to="/produtos" replace />} />
            <Route path="/ds-voice" element={<Navigate to="/mensagens-rapidas" replace />} />
            <Route path="/automacoes-filas" element={<Navigate to="/filas" replace />} />
            <Route path="/administracao-acoes" element={<Navigate to="/configuracao-acoes" replace />} />
            <Route path="/workspace-empresas" element={<Navigate to="/empresa" replace />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
            </BrowserRouter>
            </RealtimeNotificationProvider>
          </WorkspaceProvider>
        </SystemCustomizationProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
