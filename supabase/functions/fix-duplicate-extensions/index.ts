import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('Iniciando correção de extensões duplicadas...')

    // Buscar mensagens com extensões duplicadas
    const { data: messagesWithDuplicateExt, error: selectError } = await supabase
      .from('messages')
      .select('id, file_url, file_name')
      .not('file_url', 'is', null)
      .like('file_url', '%.jpeg.jpeg')
      .or('file_url.like.%.jpg.jpg,file_url.like.%.png.png,file_url.like.%.gif.gif,file_url.like.%.webp.webp')

    if (selectError) {
      throw new Error(`Erro ao buscar mensagens: ${selectError.message}`)
    }

    console.log(`Encontradas ${messagesWithDuplicateExt?.length || 0} mensagens com extensões duplicadas`)

    const results = {
      processed: 0,
      fixed: 0,
      errors: 0,
      details: [] as any[]
    }

    if (messagesWithDuplicateExt && messagesWithDuplicateExt.length > 0) {
      for (const message of messagesWithDuplicateExt) {
        results.processed++
        
        try {
          const originalUrl = message.file_url
          const originalName = message.file_name
          
          // Corrigir URL removendo extensão duplicada
          let fixedUrl = originalUrl
          let fixedName = originalName

          // Padrões de extensões duplicadas
          const duplicatePatterns = [
            /\.jpeg\.jpeg$/i,
            /\.jpg\.jpg$/i,
            /\.png\.png$/i,
            /\.gif\.gif$/i,
            /\.webp\.webp$/i
          ]

          for (const pattern of duplicatePatterns) {
            if (pattern.test(fixedUrl)) {
              fixedUrl = fixedUrl.replace(pattern, (match: string) => match.substring(0, match.length / 2))
              break
            }
          }

          if (fixedName) {
            for (const pattern of duplicatePatterns) {
              if (pattern.test(fixedName)) {
                fixedName = fixedName.replace(pattern, (match: string) => match.substring(0, match.length / 2))
                break
              }
            }
          }

          // Só atualizar se houve mudança
          if (fixedUrl !== originalUrl || fixedName !== originalName) {
            const { error: updateError } = await supabase
              .from('messages')
              .update({
                file_url: fixedUrl,
                file_name: fixedName
              })
              .eq('id', message.id)

            if (updateError) {
              console.error(`Erro ao atualizar mensagem ${message.id}:`, updateError)
              results.errors++
              results.details.push({
                id: message.id,
                error: updateError.message,
                originalUrl,
                fixedUrl
              })
            } else {
              results.fixed++
              results.details.push({
                id: message.id,
                originalUrl,
                fixedUrl,
                originalName,
                fixedName,
                status: 'fixed'
              })
              console.log(`Mensagem ${message.id} corrigida: ${originalUrl} -> ${fixedUrl}`)
            }
          }
        } catch (error) {
          console.error(`Erro ao processar mensagem ${message.id}:`, error)
          results.errors++
          results.details.push({
            id: message.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    }

    console.log('Correção concluída:', results)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Correção de extensões duplicadas concluída',
        results
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Erro na correção de extensões duplicadas:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Falha na correção de extensões duplicadas',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})