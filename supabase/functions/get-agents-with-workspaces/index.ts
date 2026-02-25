import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Buscar todos os agentes
    const { data: agents, error: agentsError } = await supabaseClient
      .from('ai_agents')
      .select('*')
      .order('created_at', { ascending: false })

    if (agentsError) {
      console.error('Erro ao buscar agentes:', agentsError)
      throw agentsError
    }

    if (!agents || agents.length === 0) {
      return new Response(
        JSON.stringify([]),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar workspaces únicos
    const workspaceIds = [...new Set(agents.map(a => a.workspace_id).filter(Boolean))]
    
    let workspacesMap = new Map()
    
    if (workspaceIds.length > 0) {
      const { data: workspaces, error: workspacesError } = await supabaseClient
        .from('workspaces')
        .select('id, name')
        .in('id', workspaceIds)

      if (workspacesError) {
        console.error('Erro ao buscar workspaces:', workspacesError)
      } else if (workspaces) {
        workspacesMap = new Map(workspaces.map(w => [w.id, w]))
      }
    }

    // Combinar dados
    const agentsWithWorkspace = agents.map(agent => ({
      ...agent,
      workspace: agent.workspace_id ? workspacesMap.get(agent.workspace_id) || null : null
    }))

    console.log('✅ Retornando agentes:', agentsWithWorkspace.length)
    console.log('✅ Workspaces encontrados:', workspacesMap.size)

    return new Response(
      JSON.stringify(agentsWithWorkspace),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Erro na função:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
