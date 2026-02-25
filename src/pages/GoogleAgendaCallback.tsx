import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspaceHeaders } from "@/lib/workspaceHeaders";

type CallbackStatus = "processing" | "success" | "error";

const GoogleAgendaCallback = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<CallbackStatus>("processing");
  const [message, setMessage] = useState("Finalizando a integração com a sua Google Agenda...");

  const headers = useMemo(() => {
    try {
      return getWorkspaceHeaders();
    } catch (error) {
      console.error("❌ Não foi possível recuperar o workspace para finalizar o OAuth", error);
      return null;
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get("code");
    const state = params.get("state")?.trim();
    const error = params.get("error");
    const errorDescription = params.get("error_description");

    if (error) {
      setStatus("error");
      setMessage(
        errorDescription ||
          "O Google cancelou o compartilhamento do calendário. Nenhuma permissão foi concedida."
      );
      return;
    }

    if (!code || !state) {
      setStatus("error");
      setMessage("Parâmetros do Google ausentes. Refaça o processo de login.");
      return;
    }

    // Validar formato do state (deve ser um UUID válido)
    const trimmedState = state.trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(trimmedState)) {
      console.error("❌ State com formato inválido recebido:", {
        state: trimmedState,
        length: trimmedState.length,
        raw: state
      });
      setStatus("error");
      setMessage("Formato de autenticação inválido. Por favor, inicie o processo novamente.");
      return;
    }

    if (!headers) {
      setStatus("error");
      setMessage("Não encontramos o workspace atual. Abra novamente a página de integração.");
      return;
    }

    const finalizeIntegration = async () => {
      try {
        setStatus("processing");
        setMessage("Confirmando as permissões junto ao Google. Aguarde alguns segundos...");

        console.log("🔐 [Callback] Enviando code e state para exchange:", {
          codeLength: code.length,
          state: trimmedState.substring(0, 8) + "..."
        });

        const { error: exchangeError, data: exchangeData } = await supabase.functions.invoke(
          "google-calendar-integration",
          {
            headers,
            body: {
              action: "exchange-code",
              code,
              state: trimmedState,
            },
          }
        );

        if (exchangeError) {
          console.error("❌ Erro ao fazer exchange:", exchangeError);
          throw exchangeError;
        }
        
        console.log("✅ Exchange concluído com sucesso:", exchangeData);

        setStatus("success");
        setMessage("Integração concluída com sucesso! Redirecionando para o painel...");

        // Se foi aberto em uma janela popup ou iframe, notificar o opener/parent
        if (window.opener) {
          window.opener.postMessage(
            { type: "google-calendar-oauth-complete", status: "success" },
            window.location.origin
          );
          window.close();
          return;
        }

        // Se estiver dentro de um iframe, notificar a janela pai
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(
            { type: "google-calendar-oauth-complete", status: "success" },
            window.location.origin
          );
          // Não fechar, apenas mostrar mensagem de sucesso
          return;
        }

        setTimeout(() => {
          navigate("/administracao-google-agenda", { replace: true });
        }, 2000);
      } catch (err: any) {
        console.error("❌ Falha ao finalizar o OAuth da Google Agenda", err);
        setStatus("error");
        
        let errorMessage = "Não foi possível concluir a integração. Tente novamente mais tarde.";
        
        if (err?.message) {
          if (err.message.includes("Invalid state format")) {
            errorMessage = "Erro no formato de autenticação. Por favor, feche esta janela e inicie o processo novamente.";
          } else if (err.message.includes("State inválido") || err.message.includes("expirado")) {
            errorMessage = "A sessão de autenticação expirou ou é inválida. Por favor, feche esta janela e inicie o processo novamente.";
          } else {
            errorMessage = err.message;
          }
        }
        
        setMessage(errorMessage);

        // Em caso de erro, também avisar o opener/parent se estivermos em um popup ou iframe
        if (window.opener) {
          window.opener.postMessage(
            {
              type: "google-calendar-oauth-complete",
              status: "error",
              message:
                err?.message ??
                "Não foi possível concluir a integração. Tente novamente mais tarde.",
            },
            window.location.origin
          );
          window.close();
          return;
        }

        // Se estiver dentro de um iframe, notificar a janela pai
        if (window.parent && window.parent !== window) {
          window.parent.postMessage(
            {
              type: "google-calendar-oauth-complete",
              status: "error",
              message:
                err?.message ??
                "Não foi possível concluir a integração. Tente novamente mais tarde.",
            },
            window.location.origin
          );
        }
      }
    };

    finalizeIntegration();
  }, [headers, location.search, navigate]);

  const icon = () => {
    if (status === "processing") {
      return <Loader2 className="w-10 h-10 text-primary animate-spin" />;
    }
    if (status === "success") {
      return <CheckCircle2 className="w-10 h-10 text-emerald-500" />;
    }
    return <ShieldAlert className="w-10 h-10 text-destructive" />;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-6">
      <Card className="max-w-xl w-full shadow-lg border-primary/10">
        <CardHeader className="text-center space-y-2">
          <CardTitle className="text-2xl">Integração com Google Agenda</CardTitle>
          <CardDescription>
            Estamos concluindo o processo de autorização segura diretamente com o Google.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <div className="flex flex-col items-center gap-4">
            {icon()}
            <p className="text-base text-muted-foreground">{message}</p>
          </div>

          {status === "error" && (
            <Button
              variant="outline"
              onClick={() => navigate("/administracao-google-agenda", { replace: true })}
            >
              Voltar para configurações
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleAgendaCallback;

