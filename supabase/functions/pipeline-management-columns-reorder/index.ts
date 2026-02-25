import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get authentication headers
    const userId = req.headers.get('x-system-user-id')
    const userEmail = req.headers.get('x-system-user-email')
    const workspaceId = req.headers.get('x-workspace-id')

    console.log('🔐 Authentication check:', { userId, userEmail, workspaceId })

    // Verify authentication
    if (!userId || !userEmail) {
      console.error('❌ Missing user authentication headers')
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // Verify workspace
    if (!workspaceId) {
      console.error('❌ Missing workspace ID')
      return new Response(JSON.stringify({ error: 'Workspace não especificado' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Parse request body
    const { columns } = await req.json()

    if (!columns || !Array.isArray(columns)) {
      return new Response(JSON.stringify({ error: 'Dados inválidos' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    console.log('📝 Updating column order:', { columnCount: columns.length })

    // Update each column's order_position
    const updates = columns.map((col: { id: string; order_position: number }) =>
      supabaseClient
        .from('pipeline_columns')
        .update({ order_position: col.order_position })
        .eq('id', col.id)
    )

    const results = await Promise.all(updates)
    
    // Check for errors
    const errors = results.filter(r => r.error)
    if (errors.length > 0) {
      console.error('❌ Error updating columns:', errors)
      return new Response(
        JSON.stringify({ error: 'Erro ao atualizar colunas', details: errors }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        }
      )
    }

    console.log('✅ Columns reordered successfully')
    return new Response(
      JSON.stringify({ success: true, message: 'Colunas reordenadas com sucesso' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error) {
    console.error('Erro ao reordenar colunas:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ error: 'Erro ao reordenar colunas', details: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
