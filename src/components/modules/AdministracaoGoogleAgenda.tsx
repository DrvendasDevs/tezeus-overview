import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { Calendar, CheckCircle2, LogOut, ShieldCheck, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspaceHeaders } from "@/lib/workspaceHeaders";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { toast } from "sonner";

interface IntegrationStatus {
  connected: boolean;
  requiresReconnect: boolean;
  googleEmail: string | null;
  authorizedAt: string | null;
  lastTokenCheckAt?: string | null;
  revokedAt: string | null;
  scopes: string[];
}

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return value;
  }
};

export function AdministracaoGoogleAgenda() {
  const { selectedWorkspace } = useWorkspace();
  const [status, setStatus] = useState<IntegrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const popupRef = useRef<Window | null>(null);

  const redirectUri = useMemo(
    () => `${window.location.origin}/google-agenda/callback`,
    []
  );

  const headers = useMemo(() => {
    try {
      return getWorkspaceHeaders(selectedWorkspace?.workspace_id);
    } catch (error) {
      console.error("❌ Erro ao montar headers do workspace", error);
      return null;
    }
  }, [selectedWorkspace?.workspace_id]);

  const loadStatus = useCallback(async () => {
    if (!headers) {
      setStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const {
        data,
        error,
      } = await supabase.functions.invoke<any>(
        "google-calendar-integration",
        {
          headers,
          body: { action: "status" },
        }
      );

      if (error) throw error;

      // Se o backend sinalizar que as credenciais globais não estão configuradas
      if (data?.error === "GOOGLE_SETTINGS_NOT_CONFIGURED") {
        setStatus(null);
        setLoading(false);
        toast.error(
          "As credenciais do aplicativo Google Agenda ainda não foram configuradas pelo painel MASTER."
        );
        return;
      }

      setStatus(data as IntegrationStatus);
    } catch (error: any) {
      console.error("❌ Erro ao carregar status da Google Agenda", error);
      toast.error(
        error?.message ??
          "Não foi possível carregar o status da integração com a Google Agenda."
      );
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);


  // Listener para mensagens do callback e verificação de popup fechada
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Verificar origem para segurança
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'google-calendar-oauth-complete') {
        // Fechar popup se ainda estiver aberta
        if (popupRef.current && !popupRef.current.closed) {
          popupRef.current.close();
          popupRef.current = null;
        }

        if (event.data.status === 'success') {
          toast.success('Integração com Google Agenda concluída com sucesso!');
          loadStatus();
        } else {
          const errorMessage = event.data.message || 'Não foi possível concluir a integração. Tente novamente.';
          console.error("❌ Erro na autenticação OAuth:", errorMessage);
          
          // Mensagens mais específicas baseadas no tipo de erro
          if (errorMessage.includes("Invalid state format") || errorMessage.includes("formato")) {
            toast.error('Erro no formato de autenticação. Por favor, tente novamente.');
          } else if (errorMessage.includes("expirado") || errorMessage.includes("expired")) {
            toast.error('A sessão de autenticação expirou. Por favor, tente novamente.');
          } else {
            toast.error(errorMessage);
          }
        }
      }
    };

    // Verificar periodicamente se a popup foi fechada manualmente
    const checkPopupClosed = setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        popupRef.current = null;
        setIsRedirecting(false);
      }
    }, 500);

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(checkPopupClosed);
    };
  }, [loadStatus]);

  const handleConnect = async () => {
    if (!headers) {
      toast.error("Selecione um workspace antes de conectar sua agenda.");
      return;
    }

    setIsRedirecting(true);
    try {
      const { data, error } = await supabase.functions.invoke<{
        authUrl?: string;
        error?: string;
      }>("google-calendar-integration", {
        headers,
        body: { action: "auth-url" },
      });

      if (error) throw error;

      if (data?.error === "GOOGLE_SETTINGS_NOT_CONFIGURED") {
        throw new Error(
          "As credenciais globais do aplicativo Google Agenda não estão configuradas. Peça ao usuário MASTER para configurá-las."
        );
      }

      if (!data?.authUrl) {
        throw new Error("Não recebemos o link de autenticação do Google.");
      }

      // Abrir popup para autenticação (Google bloqueia iframes)
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        data.authUrl,
        'google-calendar-auth',
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      if (!popup) {
        throw new Error(
          "Não foi possível abrir a janela de autenticação. Verifique se o bloqueador de popups está desativado."
        );
      }

      popupRef.current = popup;
    } catch (error: any) {
      console.error("❌ Erro ao iniciar OAuth com Google", error);
      toast.error(
        error?.message ??
          "Não foi possível iniciar o login com Google. Tente novamente."
      );
    } finally {
      setIsRedirecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!headers) return;
    setIsDisconnecting(true);

    try {
      const { error } = await supabase.functions.invoke(
        "google-calendar-integration",
        {
          headers,
          body: { action: "disconnect" },
        }
      );

      if (error) throw error;
      toast.success("Integração com Google Agenda desconectada.");
      loadStatus();
    } catch (error: any) {
      console.error("❌ Erro ao desconectar integração Google Agenda", error);
      toast.error(
        error?.message ?? "Não foi possível desconectar da Google Agenda."
      );
    } finally {
      setIsDisconnecting(false);
    }
  };

  const renderStatusSection = () => {
    if (loading) {
      return (
        <div className="space-y-4">
          <Skeleton className="h-6 w-48 dark:bg-gray-800" />
          <Skeleton className="h-4 w-80 dark:bg-gray-800" />
          <Skeleton className="h-12 w-full dark:bg-gray-800" />
        </div>
      );
    }

    if (!headers) {
      return (
        <Alert variant="destructive" className="dark:border-red-800 dark:bg-red-900/20">
          <AlertTitle className="dark:text-red-200">Selecione um workspace</AlertTitle>
          <AlertDescription className="dark:text-red-300">
            É necessário escolher um workspace antes de configurar a Google
            Agenda.
          </AlertDescription>
        </Alert>
      );
    }

    if (!status?.connected) {
      return (
        <div className="space-y-6">
          {status?.requiresReconnect && (
            <Alert variant="destructive" className="dark:border-red-800 dark:bg-red-900/20">
              <AlertTitle className="dark:text-red-200">Conexão expirada</AlertTitle>
              <AlertDescription className="dark:text-red-300">
                Precisamos que você refaça o login com Google para continuar
                criando eventos automaticamente.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <p className="text-base text-muted-foreground dark:text-gray-300">
              Conecte sua conta Google para permitir a criação automática de
              eventos no seu Google Agenda diretamente pelo sistema.
            </p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground dark:text-gray-400 space-y-1">
              <li>Cada usuário conecta apenas o próprio calendário.</li>
              <li>Os eventos criados ficam visíveis somente para você.</li>
              <li>Nenhuma configuração técnica adicional é necessária.</li>
            </ul>
          </div>

          <Button
            size="lg"
            className="gap-2"
            onClick={handleConnect}
            disabled={isRedirecting}
          >
            {isRedirecting ? (
              <RefreshCcw className="w-4 h-4 animate-spin" />
            ) : (
              <Calendar className="w-4 h-4" />
            )}
            Fazer login com Google para ativar a Agenda
          </Button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge
            variant="secondary"
            className="gap-2 px-3 py-1 border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-200"
          >
            <CheckCircle2 className="w-4 h-4" />
            Conectado
          </Badge>
          {status.requiresReconnect && (
            <Badge variant="destructive" className="dark:bg-red-900/20 dark:text-red-200 dark:border-red-800">
              Reconexão necessária
            </Badge>
          )}
          <span className="text-sm text-muted-foreground dark:text-gray-400">
            {status.googleEmail}
          </span>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-lg border p-4 space-y-1 dark:border-gray-700 dark:bg-[#111111]">
            <p className="text-sm text-muted-foreground dark:text-gray-400">Última autorização</p>
            <p className="font-medium dark:text-gray-200">{formatDateTime(status.authorizedAt)}</p>
          </div>
          <div className="rounded-lg border p-4 space-y-1 dark:border-gray-700 dark:bg-[#111111]">
            <p className="text-sm text-muted-foreground dark:text-gray-400">Última verificação</p>
            <p className="font-medium dark:text-gray-200">{formatDateTime(status.lastTokenCheckAt)}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground dark:text-gray-400">Escopos autorizados</p>
          <div className="flex flex-wrap gap-2">
            {status.scopes?.length ? (
              status.scopes.map((scope) => (
                <Badge key={scope} variant="outline" className="font-mono text-[11px] dark:border-gray-700 dark:text-gray-300">
                  {scope}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground dark:text-gray-400">Nenhum escopo registrado.</span>
            )}
          </div>
        </div>

        <Alert className="dark:border-gray-700 dark:bg-[#111111]">
          <ShieldCheck className="w-4 h-4 dark:text-gray-300" />
          <AlertTitle className="dark:text-gray-100">Tokens seguros e revogáveis</AlertTitle>
          <AlertDescription className="dark:text-gray-300">
            Armazenamos apenas o e-mail e o refresh token, sem persistir o access token.
            Sempre que precisarmos criar um evento, geramos um novo access token temporário. Se o token ficar inválido, ele é revogado automaticamente e você será orientado a reconectar.
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="destructive"
            className="gap-2"
            onClick={handleDisconnect}
            disabled={isDisconnecting}
          >
            {isDisconnecting ? (
              <RefreshCcw className="w-4 h-4 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            Desconectar Google Agenda
          </Button>
          <Button
            variant="secondary"
            className="gap-2"
            onClick={loadStatus}
            disabled={loading}
          >
            <RefreshCcw className="w-4 h-4" />
            Recarregar status
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 bg-white dark:bg-[#050505]">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Google Agenda</h1>
        <p className="text-muted-foreground dark:text-gray-400">
          Configure a integração oficial com a Google Agenda para que o Tezeus
          crie eventos automaticamente no seu calendário pessoal.
        </p>
      </div>

      <Card className="border-primary/20 shadow-lg dark:border-gray-700 dark:bg-[#0b0b0b]">
        <CardHeader className="dark:bg-[#0b0b0b]">
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <Calendar className="w-5 h-5 text-primary" />
            Integração com Google Agenda
          </CardTitle>
          <CardDescription className="dark:text-gray-400">
            Conecte sua conta Google para permitir a criação automática de eventos no seu Google Agenda diretamente pelo sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="dark:bg-[#0b0b0b]">{renderStatusSection()}</CardContent>
      </Card>

      <Alert className="dark:border-gray-700 dark:bg-[#111111]">
        <AlertTitle className="dark:text-gray-100">Como funciona?</AlertTitle>
        <AlertDescription className="space-y-2 dark:text-gray-300">
          <p>
            Assim que você autorizar o acesso, o sistema passa a criar eventos no seu próprio Google Agenda.
            Nenhum outro usuário consegue ver ou alterar os eventos gerados para você.
          </p>
          <ul className="list-disc pl-5 text-sm text-muted-foreground dark:text-gray-400 space-y-1">
            <li>Suporte nativo a múltiplos usuários dentro do mesmo workspace.</li>
            <li>O consentimento é solicitado diretamente pelo Google com escopo Calendar.</li>
            <li>Usamos acesso offline para manter os eventos funcionando continuamente.</li>
          </ul>
        </AlertDescription>
      </Alert>

    </div>
  );
}

