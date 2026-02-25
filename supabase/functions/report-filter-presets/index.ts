import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-workspace-id, x-system-user-id, x-system-user-email",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};

type ReportFilters = {
  customConv?: {
    periodPreset?: string;
    agent?: string;
    tags?: string[];
    status?: string;
  };
  teamConv?: {
    periodPreset?: string;
    agent?: string;
    tags?: string[];
    status?: string;
  };
  salesRanking?: {
    periodPreset?: string;
    visibleUsers?: string[];
  };
  workRanking?: {
    periodPreset?: string;
    visibleUsers?: string[];
  };
  funnels?: Array<{
    id: string;
    name: string;
    filters: Array<{ type: string; value: string; operator?: string }>;
  }>;
  // Conversões customizadas salvas para toda a empresa
  customConversions?: any[];
  teamConversions?: any[];
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const userId = req.headers.get("x-system-user-id");
    const workspaceIdHeader = req.headers.get("x-workspace-id");

    const body = await req.json().catch(() => ({}));
    const workspaceId = body.workspaceId || workspaceIdHeader;

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

    // Validate role + membership
    const [{ data: su, error: suError }, { data: wm, error: wmError }] = await Promise.all([
      supabase.from("system_users").select("id, profile").eq("id", userId).maybeSingle(),
      supabase
        .from("workspace_members")
        .select("user_id, workspace_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (suError) throw suError;
    if (wmError) throw wmError;

    const profile = (su as any)?.profile || null;
    // Masters e support têm acesso a todos os workspaces (mesmo sem registro em workspace_members)
    const isMasterOrSupport = profile === "master" || profile === "support";
    const isMember = isMasterOrSupport || Boolean(wm);
    const canWrite = isMember && (profile === "master" || profile === "admin");

    // GET: return saved filters (or POST without filters = GET)
    if (req.method === "GET" || !body || typeof body !== "object" || body.filters === undefined) {
      if (!isMember) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("report_filter_presets")
        .select("workspace_id, filters")
        .eq("workspace_id", workspaceId)
        .maybeSingle();

      if (error) throw error;
      
      return new Response(
        JSON.stringify({ 
          filters: (data as any)?.filters || {},
          canEdit: canWrite
        }), 
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // POST: save filters
    if (!canWrite) {
      return new Response(JSON.stringify({ error: "forbidden", message: "Apenas Admin/Master podem salvar filtros." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const filters = body.filters as ReportFilters;
    
    // Sanitize the filters object
    const sanitized: ReportFilters = {};
    
    if (filters.customConv) {
      sanitized.customConv = {
        periodPreset: String(filters.customConv.periodPreset || "last30"),
        agent: String(filters.customConv.agent || "all"),
        tags: Array.isArray(filters.customConv.tags) ? filters.customConv.tags : [],
        status: String(filters.customConv.status || "all"),
      };
    }
    
    if (filters.teamConv) {
      sanitized.teamConv = {
        periodPreset: String(filters.teamConv.periodPreset || "last30"),
        agent: String(filters.teamConv.agent || "all"),
        tags: Array.isArray(filters.teamConv.tags) ? filters.teamConv.tags : [],
        status: String(filters.teamConv.status || "all"),
      };
    }
    
    if (filters.salesRanking) {
      sanitized.salesRanking = {
        periodPreset: String(filters.salesRanking.periodPreset || "last30"),
        visibleUsers: Array.isArray(filters.salesRanking.visibleUsers) ? filters.salesRanking.visibleUsers : [],
      };
    }
    
    if (filters.workRanking) {
      sanitized.workRanking = {
        periodPreset: String(filters.workRanking.periodPreset || "last30"),
        visibleUsers: Array.isArray(filters.workRanking.visibleUsers) ? filters.workRanking.visibleUsers : [],
      };
    }
    
    if (filters.funnels && Array.isArray(filters.funnels)) {
      sanitized.funnels = filters.funnels.map((f, idx) => ({
        id: String(f?.id || `funnel-${idx + 1}`),
        name: String(f?.name || `Funil ${idx + 1}`),
        filters: Array.isArray(f?.filters) ? f.filters : [],
      }));
    }

    // Conversões customizadas (salvas para toda a empresa)
    if (filters.customConversions && Array.isArray(filters.customConversions)) {
      sanitized.customConversions = filters.customConversions.map((c: any) => ({
        id: String(c?.id || crypto.randomUUID()),
        name: String(c?.name || ''),
        pipelineA: String(c?.pipelineA || 'all'),
        columnA: String(c?.columnA || 'all'),
        pipelineB: String(c?.pipelineB || 'all'),
        columnB: String(c?.columnB || 'all'),
      }));
    }

    if (filters.teamConversions && Array.isArray(filters.teamConversions)) {
      sanitized.teamConversions = filters.teamConversions.map((c: any) => ({
        id: String(c?.id || crypto.randomUUID()),
        name: String(c?.name || ''),
        metricA: String(c?.metricA || 'leads'),
        metricB: String(c?.metricB || 'leads'),
      }));
    }

    const { error: upsertError } = await supabase.from("report_filter_presets").upsert(
      {
        workspace_id: workspaceId,
        filters: sanitized,
        created_by_id: userId,
        updated_by_id: userId,
      },
      { onConflict: "workspace_id" }
    );

    if (upsertError) throw upsertError;

    return new Response(JSON.stringify({ success: true, filters: sanitized }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("❌ [report-filter-presets] error:", e);
    return new Response(JSON.stringify({ error: (e as any)?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
