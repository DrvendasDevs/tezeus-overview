import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-workspace-id, x-system-user-id, x-system-user-email",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type Body = {
  workspaceId?: string;
  from?: string | null;
  to?: string | null;
  userRole?: string | null;
  userId?: string | null;
  includeContacts?: boolean;
  includeActivities?: boolean;
  includeConversations?: boolean;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const headerUserId = req.headers.get("x-system-user-id");
    const workspaceIdHeader = req.headers.get("x-workspace-id");
    const body = (await req.json().catch(() => ({}))) as Body;

    const workspaceId = body.workspaceId || workspaceIdHeader;
    const userId = body.userId || headerUserId;
    const userRole = String(body.userRole || "").toLowerCase();
    // support também precisa ter acesso privilegiado (mesmo sem membership explícito)
    const isPrivileged = userRole === "master" || userRole === "admin" || userRole === "support";

    if (!userId) {
      return new Response(JSON.stringify({ error: "missing x-system-user-id" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "workspaceId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Membership check (read allowed for any member)
    // Admin/Master podem acessar qualquer workspace
    if (!isPrivileged) {
      console.log(`🔍 [report-base-data-lite] Verificando membership: userId=${userId}, workspaceId=${workspaceId}`);
      
      const { data: wm, error: wmError } = await supabase
        .from("workspace_members")
        .select("user_id, workspace_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .maybeSingle();

      console.log(`🔍 [report-base-data-lite] Membership result:`, { wm, wmError });

      if (wmError) throw wmError;
      if (!wm) {
        console.error(`❌ [report-base-data-lite] Usuário ${userId} não é membro do workspace ${workspaceId}`);
        return new Response(JSON.stringify({ error: "forbidden", details: `User ${userId} is not a member of workspace ${workspaceId}` }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      console.log(`✅ [report-base-data-lite] Acesso privilegiado para role=${userRole}`);
    }

    const from = body.from ?? null;
    const to = body.to ?? null;
    const hasRange = !!(from && to);
    // Removido isUserScoped - a filtragem por agente é feita no frontend baseada no filtro selecionado

    const includeContacts = body.includeContacts !== false; // default true
    const includeActivities = body.includeActivities !== false; // default true
    const includeConversations = body.includeConversations !== false; // default true

    const contactsPromise = includeContacts
      ? (() => {
          let q = supabase
            .from("contacts")
            .select("id, created_at, workspace_id")
            .eq("workspace_id", workspaceId);
          if (hasRange && from && to) q = q.gte("created_at", from).lte("created_at", to);
          return q;
        })()
      : Promise.resolve({ data: [], error: null } as any);

    const activitiesPromise = includeActivities
      ? (() => {
          let q = supabase
            .from("activities")
            .select("id, contact_id, responsible_id, type, created_at, scheduled_for, completed_at, workspace_id")
            .eq("workspace_id", workspaceId);
          if (hasRange && from && to) {
            q = q.or(
              [
                `and(scheduled_for.gte.${from},scheduled_for.lte.${to})`,
                `and(completed_at.gte.${from},completed_at.lte.${to})`,
                `and(created_at.gte.${from},created_at.lte.${to})`,
              ].join(",")
            );
          }
          // Removido filtro por userRole - filtragem é feita no frontend
          return q;
        })()
      : Promise.resolve({ data: [], error: null } as any);

    const conversationsPromise = includeConversations
      ? (() => {
          let q = supabase
            .from("conversations")
            .select("id, contact_id, assigned_user_id, created_at, workspace_id")
            .eq("workspace_id", workspaceId);
          if (hasRange && from && to) q = q.gte("created_at", from).lte("created_at", to);
          // Removido filtro por userRole - filtragem é feita no frontend
          return q;
        })()
      : Promise.resolve({ data: [], error: null } as any);

    const [
      { data: contacts, error: contactsError },
      { data: activities, error: activitiesError },
      { data: conversations, error: conversationsError },
    ] = await Promise.all([contactsPromise, activitiesPromise, conversationsPromise]);

    if (contactsError) throw contactsError;
    if (activitiesError) throw activitiesError;
    if (conversationsError) throw conversationsError;

    return new Response(
      JSON.stringify({
        contacts: contacts || [],
        activities: activities || [],
        conversations: conversations || [],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("❌ [report-base-data-lite] error:", e);
    return new Response(JSON.stringify({ error: (e as any)?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

