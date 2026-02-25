import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { cargoId } = await req.json()

    console.log(`🔍 Recebido request para deletar cargo: ${cargoId}`)

    if (!cargoId) {
      return new Response(
        JSON.stringify({ error: 'cargoId é obrigatório' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Criar client com service_role para acessar system_users
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    console.log(`🔍 Verificando usuários que usam o cargo: ${cargoId}`)

    // 1. Primeiro, verificar quais usuários usam este cargo
    const { data: usuarios, error: checkError } = await supabaseAdmin
      .from('system_users')
      .select('id, name')
      .eq('cargo_id', cargoId)

    if (checkError) {
      console.error('❌ Error checking cargo usage:', checkError)
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar uso do cargo' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const userNames = usuarios ? usuarios.map(u => u.name) : []
    console.log(`👥 Usuários encontrados: ${userNames.join(', ')}`)

    // 2. Se há usuários usando o cargo, remover o cargo deles
    if (usuarios && usuarios.length > 0) {
      console.log('🔄 Removendo cargo dos usuários...')
      
      const { error: updateError } = await supabaseAdmin
        .from('system_users')
        .update({ cargo_id: null })
        .eq('cargo_id', cargoId)

      if (updateError) {
        console.error('❌ Error removing cargo from users:', updateError)
        return new Response(
          JSON.stringify({ error: 'Erro ao remover cargo dos usuários' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      console.log('✅ Cargo removido dos usuários com sucesso')
    }

    // 3. Agora excluir o cargo
    console.log('🗑️ Excluindo cargo do banco...')
    
    const { error: deleteError } = await supabaseAdmin
      .from('cargos')
      .delete()
      .eq('id', cargoId)

    if (deleteError) {
      console.error('❌ Error deleting cargo:', deleteError)
      return new Response(
        JSON.stringify({ error: 'Erro ao excluir cargo' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    console.log('✅ Cargo excluído com sucesso')
    
    return new Response(
      JSON.stringify({ 
        success: true,
        message: userNames.length > 0 
          ? `Cargo excluído com sucesso! Removido de ${userNames.length} usuário(s): ${userNames.join(', ')}`
          : "Cargo excluído com sucesso!",
        usersAffected: userNames,
        count: userNames.length
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('💥 Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})