import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const getEnvOrThrow = (key: string) => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      getEnvOrThrow("SUPABASE_URL"),
      getEnvOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.json().catch(() => ({}));
    const action = body?.action as string | undefined;

    if (!action) {
      return new Response(
        JSON.stringify({ error: "Missing action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "status") {
      const { data, error } = await supabase
        .from("system_google_calendar_settings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("❌ Erro ao buscar configurações do Google Calendar:", error);
        return new Response(
          JSON.stringify({ error: "DATABASE_ERROR" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(JSON.stringify(data ?? null), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update") {
      const payload = body?.payload as {
        client_id?: string;
        client_secret?: string;
        redirect_uri?: string;
        project_id?: string | null;
        webhook_url?: string | null;
      };

      if (!payload?.client_id || !payload?.redirect_uri) {
        return new Response(
          JSON.stringify({ error: "MISSING_FIELDS" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Buscar registro atual (se existir)
      const { data: existing, error: fetchError } = await supabase
        .from("system_google_calendar_settings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error("❌ Erro ao buscar configurações existentes:", fetchError);
        return new Response(
          JSON.stringify({ error: "DATABASE_ERROR" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updateData: any = {
        client_id: payload.client_id,
        redirect_uri: payload.redirect_uri,
        project_id: payload.project_id ?? null,
        webhook_url: payload.webhook_url ?? null,
      };

      if (payload.client_secret) {
        updateData.client_secret = payload.client_secret;
      }

      let result;

      if (existing) {
        const { data, error } = await supabase
          .from("system_google_calendar_settings")
          .update(updateData)
          .eq("id", existing.id)
          .select()
          .single();

        if (error) {
          console.error("❌ Erro ao atualizar configurações do Google Calendar:", error);
          return new Response(
            JSON.stringify({ error: "DATABASE_ERROR" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        result = data;
      } else {
        if (!payload.client_secret) {
          return new Response(
            JSON.stringify({ error: "MISSING_CLIENT_SECRET" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data, error } = await supabase
          .from("system_google_calendar_settings")
          .insert({
            client_id: payload.client_id,
            client_secret: payload.client_secret,
            redirect_uri: payload.redirect_uri,
            project_id: payload.project_id ?? null,
            webhook_url: payload.webhook_url ?? null,
          })
          .select()
          .single();

        if (error) {
          console.error("❌ Erro ao criar configurações do Google Calendar:", error);
          return new Response(
            JSON.stringify({ error: "DATABASE_ERROR" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        result = data;
      }

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "INVALID_ACTION" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Erro inesperado em google-calendar-settings:", error);
    return new Response(
      JSON.stringify({ error: "INTERNAL_ERROR", message: error?.message ?? String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});


