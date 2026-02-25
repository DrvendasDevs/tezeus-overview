import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    
    // Get authentication headers
    const systemUserId = req.headers.get('x-system-user-id')
    const systemUserEmail = req.headers.get('x-system-user-email')
    const workspaceId = req.headers.get('x-workspace-id')

    console.log('Headers received:', {
      'x-system-user-id': systemUserId,
      'x-system-user-email': systemUserEmail,
      'x-workspace-id': workspaceId,
    })

    if (!systemUserId) {
      return new Response(
        JSON.stringify({ error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Set user context for RLS
    await supabase.rpc('set_current_user_context', {
      user_id: systemUserId,
      user_email: systemUserEmail || '',
    })

    const { action, queueId, userIds, userId, newPosition } = await req.json()

    console.log(`Action: ${action} for queue: ${queueId}`)

    switch (action) {
      case 'list': {
        const { data, error } = await supabase
          .from('queue_users')
          .select(`
            *,
            system_users (
              id,
              name,
              email,
              profile,
              avatar
            )
          `)
          .eq('queue_id', queueId)
          .order('order_position', { ascending: true })

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, users: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'add': {
        // Get max position
        const { data: existingUsers } = await supabase
          .from('queue_users')
          .select('order_position')
          .eq('queue_id', queueId)
          .order('order_position', { ascending: false })
          .limit(1)

        const maxPosition = existingUsers?.[0]?.order_position ?? -1

        // Create queue user records
        const queueUsers = userIds.map((userId: string, index: number) => ({
          queue_id: queueId,
          user_id: userId,
          order_position: maxPosition + index + 1,
        }))

        const { error } = await supabase
          .from('queue_users')
          .insert(queueUsers)

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, message: `${userIds.length} usuário(s) adicionado(s)` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'remove': {
        const { error } = await supabase
          .from('queue_users')
          .delete()
          .eq('queue_id', queueId)
          .eq('user_id', userId)

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, message: 'Usuário removido' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'updateOrder': {
        const { error } = await supabase
          .from('queue_users')
          .update({ order_position: newPosition })
          .eq('queue_id', queueId)
          .eq('user_id', userId)

        if (error) throw error

        return new Response(
          JSON.stringify({ success: true, message: 'Ordem atualizada' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Ação inválida' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error: any) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
