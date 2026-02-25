import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

function generateApiKey(): string {
  const prefix = "tez_";
  const uuid = crypto.randomUUID().replace(/-/g, "");
  const timestamp = Date.now().toString(36);
  return `${prefix}${uuid}${timestamp}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { action, workspace_id, api_key_id, name, is_active } = await req.json();

    if (!workspace_id) {
      return new Response(
        JSON.stringify({ error: "workspace_id é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    switch (action) {
      case "list": {
        const { data, error } = await supabase
          .from("workspace_api_keys")
          .select("*")
          .eq("workspace_id", workspace_id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create": {
        if (!name) {
          return new Response(
            JSON.stringify({ error: "name é obrigatório" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const apiKey = generateApiKey();

        const { data, error } = await supabase
          .from("workspace_api_keys")
          .insert({
            workspace_id,
            api_key: apiKey,
            name: name.trim(),
            is_active: true,
          })
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update": {
        if (!api_key_id) {
          return new Response(
            JSON.stringify({ error: "api_key_id é obrigatório" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const updateData: any = {};
        if (name !== undefined) updateData.name = name.trim();
        if (is_active !== undefined) updateData.is_active = is_active;

        const { data, error } = await supabase
          .from("workspace_api_keys")
          .update(updateData)
          .eq("id", api_key_id)
          .eq("workspace_id", workspace_id)
          .select()
          .single();

        if (error) throw error;

        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete": {
        if (!api_key_id) {
          return new Response(
            JSON.stringify({ error: "api_key_id é obrigatório" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        const { error } = await supabase
          .from("workspace_api_keys")
          .delete()
          .eq("id", api_key_id)
          .eq("workspace_id", workspace_id);

        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: "Ação inválida" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
    }
  } catch (error: any) {
    console.error("Erro na função:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno do servidor" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

