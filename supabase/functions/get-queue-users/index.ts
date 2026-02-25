import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { queueId } = await req.json()

    if (!queueId) {
      return new Response(
        JSON.stringify({ error: 'queueId é obrigatório' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

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

    console.log('🔍 Buscando usuários da fila:', queueId)

    // Buscar usuários da fila
    const { data: queueUsers, error: queueUsersError } = await supabaseClient
      .from('queue_users')
      .select('id, queue_id, user_id, order_position, created_at')
      .eq('queue_id', queueId)
      .order('order_position', { ascending: true })

    if (queueUsersError) {
      console.error('❌ Erro ao buscar queue_users:', queueUsersError)
      throw queueUsersError
    }

    if (!queueUsers || queueUsers.length === 0) {
      console.log('ℹ️ Nenhum usuário encontrado na fila')
      return new Response(
        JSON.stringify([]),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('✅ Queue users encontrados:', queueUsers.length)

    // Buscar dados dos usuários
    const userIds = queueUsers.map(qu => qu.user_id)
    const { data: users, error: usersError } = await supabaseClient
      .from('system_users')
      .select('id, name, email, profile, avatar')
      .in('id', userIds)

    if (usersError) {
      console.error('❌ Erro ao buscar system_users:', usersError)
      throw usersError
    }

    console.log('✅ System users encontrados:', users?.length || 0)

    // Mapear usuários para criar estrutura de dados final
    const usersMap = new Map(users?.map(u => [u.id, u]) || [])

    const result = queueUsers.map(qu => ({
      ...qu,
      system_users: usersMap.get(qu.user_id) || null
    }))

    console.log('✅ Retornando usuários da fila:', result.length)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('💥 Erro na função:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
