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

    // Buscar todas as filas
    const { data: queues, error: queuesError } = await supabaseClient
      .from('queues')
      .select('*')
      .order('created_at', { ascending: false })

    if (queuesError) {
      console.error('Erro ao buscar filas:', queuesError)
      throw queuesError
    }

    if (!queues || queues.length === 0) {
      return new Response(
        JSON.stringify([]),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar workspaces únicos
    const workspaceIds = [...new Set(queues.map(q => q.workspace_id).filter(Boolean))]
    
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

    // Buscar contagem de usuários por fila
    const queueIds = queues.map(q => q.id)
    let userCountMap = new Map()

    if (queueIds.length > 0) {
      const { data: queueUsers, error: queueUsersError } = await supabaseClient
        .from('queue_users')
        .select('queue_id')
        .in('queue_id', queueIds)

      if (queueUsersError) {
        console.error('Erro ao buscar usuários das filas:', queueUsersError)
      } else if (queueUsers) {
        // Contar usuários por fila
        const counts = queueUsers.reduce((acc, qu) => {
          acc[qu.queue_id] = (acc[qu.queue_id] || 0) + 1
          return acc
        }, {} as Record<string, number>)
        
        userCountMap = new Map(Object.entries(counts))
      }
    }

    // Combinar dados
    const queuesWithWorkspace = queues.map(queue => ({
      ...queue,
      workspaces: queue.workspace_id ? workspacesMap.get(queue.workspace_id) || null : null,
      user_count: userCountMap.get(queue.id) || 0
    }))

    console.log('✅ Retornando filas:', queuesWithWorkspace.length)
    console.log('✅ Workspaces encontrados:', workspacesMap.size)

    return new Response(
      JSON.stringify(queuesWithWorkspace),
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