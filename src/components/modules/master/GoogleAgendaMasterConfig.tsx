import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Lock, RefreshCcw, Save, Calendar } from "lucide-react";

interface GoogleSettings {
  id: string;
  client_id: string;
  client_secret: string;
  redirect_uri: string;
  project_id?: string | null;
  webhook_url?: string | null;
  created_at: string;
  updated_at: string;
}

export function GoogleAgendaMasterConfig() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<GoogleSettings | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [projectId, setProjectId] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const maskedSecret = settings?.client_secret
    ? `${settings.client_secret.slice(0, 4)}••••${settings.client_secret.slice(-4)}`
    : "";

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke<GoogleSettings | null>(
        "google-calendar-settings",
        {
          body: { action: "status" },
        }
      );

      if (error) throw error;

      if (data) {
        setSettings(data);
        setClientId(data.client_id);
        setRedirectUri(data.redirect_uri);
        setProjectId(data.project_id || "");
        setWebhookUrl(data.webhook_url || "");
        setClientSecret(""); // nunca preencher o secret completo no input
      } else {
        setSettings(null);
        setClientId("");
        setClientSecret("");
        setRedirectUri("");
        setProjectId("");
        setWebhookUrl("");
      }
    } catch (error: any) {
      console.error("❌ Erro ao carregar configurações do Google Agenda", error);
      toast({
        title: "Erro ao carregar configurações",
        description:
          error?.message ??
          "Não foi possível carregar as credenciais da aplicação Google. Verifique sua conexão.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (!clientId.trim() || !redirectUri.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Client ID e Redirect URI são obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    if (!clientSecret.trim() && !settings?.client_secret) {
      toast({
        title: "Client Secret obrigatório",
        description:
          "Informe o Client Secret pelo menos uma vez. Depois você poderá atualizá-lo apenas quando necessário.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const { data, error } = await supabase.functions.invoke<GoogleSettings>(
        "google-calendar-settings",
        {
          body: {
            action: "update",
            payload: {
              client_id: clientId.trim(),
              client_secret: clientSecret.trim() || undefined,
              redirect_uri: redirectUri.trim(),
              project_id: projectId.trim() || null,
              webhook_url: webhookUrl.trim() || null,
            },
          },
        }
      );

      if (error) throw error;

      setSettings(data);
      setClientSecret(""); // limpar campo após salvar

      toast({
        title: "Configurações salvas",
        description: "As credenciais do aplicativo Google Agenda foram atualizadas com sucesso.",
      });
    } catch (error: any) {
      console.error("❌ Erro ao salvar configurações do Google Agenda", error);
      toast({
        title: "Erro ao salvar configurações",
        description:
          error?.message ??
          "Não foi possível salvar as credenciais do aplicativo Google. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const hasValidSettings = Boolean(
    settings?.client_id && settings?.client_secret && settings?.redirect_uri
  );

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#050505]">
      <div className="border-b border-[#d4d4d4] px-4 py-2 bg-[#f3f3f3] dark:bg-[#0f0f0f] dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-700 dark:text-gray-200" />
            <div>
              <h1 className="text-sm font-bold tracking-wide text-gray-800 dark:text-gray-100 uppercase">
                Configurações do Google Agenda
              </h1>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Defina as credenciais do aplicativo Google Cloud usadas por todos os workspaces.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={hasValidSettings ? "default" : "destructive"}
              className="text-[11px] rounded-none"
            >
              {hasValidSettings ? "Configuração válida" : "Configuração incompleta"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs rounded-none"
              onClick={loadSettings}
              disabled={loading}
            >
              <RefreshCcw className="w-3 h-3 mr-1" />
              Recarregar
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <Card className="max-w-3xl border border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#0b0b0b]">
          <CardHeader className="bg-white dark:bg-[#0b0b0b] pb-3">
            <CardTitle className="text-sm text-gray-900 dark:text-gray-100">
              Credenciais do aplicativo Google
            </CardTitle>
            <CardDescription className="text-xs text-gray-600 dark:text-gray-400">
              Essas credenciais são usadas para gerar os links de login e trocar os tokens de
              autorização de cada usuário.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 bg-white dark:bg-[#0b0b0b]">
            <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-100">
              <Lock className="w-4 h-4 mr-2" />
              <AlertTitle className="text-xs font-semibold">Segurança</AlertTitle>
              <AlertDescription className="text-xs">
                O <strong>Client Secret</strong> nunca será exibido completo. Você pode sobrescrever o
                valor sempre que precisar, e apenas o hash atualizado será usado pela integração.
              </AlertDescription>
            </Alert>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Client ID
                </Label>
                <Input
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="Ex: 1234567890-abcdefg.apps.googleusercontent.com"
                  className="h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1f1f1f] text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Project ID (opcional)
                </Label>
                <Input
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  placeholder="Ex: meu-projeto-google"
                  className="h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1f1f1f] text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Client Secret
                </Label>
                <Input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder={
                    settings?.client_secret
                      ? `Mantendo valor atual (${maskedSecret}) - preencha para alterar`
                      : "Informe o client secret do app Google"
                  }
                  className="h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1f1f1f] text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Redirect URI
                </Label>
                <Input
                  value={redirectUri}
                  onChange={(e) => setRedirectUri(e.target.value)}
                  placeholder="Ex: https://seu-dominio.com/google-agenda/callback"
                  className="h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1f1f1f] text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Webhook URL do N8N (opcional)
              </Label>
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="Ex: https://seu-n8n.com/webhook/google-calendar-event"
                className="h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1f1f1f] text-gray-900 dark:text-gray-100 placeholder:text-gray-500 dark:placeholder:text-gray-400"
              />
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                URL do webhook N8N global para processar eventos do Google Calendar. Será usada como fallback quando o workspace não tiver webhook específico configurado.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div className="text-[11px] text-gray-500 dark:text-gray-400">
                Essas credenciais serão usadas por todas as empresas e usuários ao fazer login na
                Google Agenda.
              </div>
              <Button
                size="sm"
                className="h-8 px-3 text-xs rounded-none"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <RefreshCcw className="w-3 h-3 mr-1 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-3 h-3 mr-1" />
                    Salvar configurações
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


