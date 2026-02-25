import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const { conversation_id: conversationId } = await req.json();

    if (!conversationId || typeof conversationId !== "string") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "conversation_id é obrigatório",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabaseClient = createClient(supabaseUrl, serviceRoleKey);

    const { data, error } = await supabaseClient
      .from("conversation_assignments")
      .select(
        "id, action, changed_at, changed_by, from_assigned_user_id, to_assigned_user_id, from_queue_id, to_queue_id",
      )
      .eq("conversation_id", conversationId)
      .order("changed_at", { ascending: false });

    if (error) {
      throw error;
    }

    const userIds = new Set<string>();
    const queueIds = new Set<string>();

    (data ?? []).forEach((entry) => {
      if (entry.from_assigned_user_id) {
        userIds.add(entry.from_assigned_user_id);
      }
      if (entry.to_assigned_user_id) {
        userIds.add(entry.to_assigned_user_id);
      }
      if (entry.changed_by) {
        userIds.add(entry.changed_by);
      }
      if (entry.from_queue_id) {
        queueIds.add(entry.from_queue_id);
      }
      if (entry.to_queue_id) {
        queueIds.add(entry.to_queue_id);
      }
    });

    let userMap = new Map<string, string>();
    if (userIds.size > 0) {
      const { data: users, error: usersError } = await supabaseClient
        .from("system_users")
        .select("id, name")
        .in("id", Array.from(userIds));

      if (usersError) {
        throw usersError;
      }

      userMap = new Map((users ?? []).map((user) => [user.id, user.name]));
    }

    let queueMap = new Map<string, string>();
    if (queueIds.size > 0) {
      const { data: queues, error: queuesError } = await supabaseClient
        .from("queues")
        .select("id, name")
        .in("id", Array.from(queueIds));

      if (queuesError) {
        throw queuesError;
      }

      queueMap = new Map((queues ?? []).map((queue) => [queue.id, queue.name]));
    }

    const items = (data ?? []).map((entry) => ({
      ...entry,
      from_user_name: entry.from_assigned_user_id
        ? userMap.get(entry.from_assigned_user_id) ?? null
        : null,
      to_user_name: entry.to_assigned_user_id
        ? userMap.get(entry.to_assigned_user_id) ?? null
        : null,
      changed_by_name: entry.changed_by
        ? userMap.get(entry.changed_by) ?? null
        : null,
      from_queue_name: entry.from_queue_id
        ? queueMap.get(entry.from_queue_id) ?? null
        : null,
      to_queue_name: entry.to_queue_id
        ? queueMap.get(entry.to_queue_id) ?? null
        : null,
    }));

    return new Response(
      JSON.stringify({ success: true, items }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("❌ conversation-assignments-history:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

