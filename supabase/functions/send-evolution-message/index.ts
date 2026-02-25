import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let requestBody;
  
  try {
    requestBody = await req.json();
    const { messageId, phoneNumber, content, messageType = 'text', fileUrl, fileName, evolutionInstance, external_id, workspaceId } = requestBody;
    
    if (!evolutionInstance) {
      return new Response(JSON.stringify({
        success: false,
        error: 'evolutionInstance is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!workspaceId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'workspaceId is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get evolution instance configuration from database
    const { data: instanceConfig, error: instanceError } = await supabase
      .from('evolution_instance_tokens')
      .select('evolution_url, token')
      .eq('instance_name', evolutionInstance)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (!instanceConfig) {
      console.error(`❌ [${messageId}] Instance not found:`, {
        evolutionInstance,
        workspaceId
      });
      return new Response(JSON.stringify({
        success: false,
        error: `Instance ${evolutionInstance} not found for workspace ${workspaceId}`
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { evolution_url: evolutionUrl, token } = instanceConfig;
    
    console.log(`🔑 [${messageId}] Instance config loaded:`, {
      evolutionUrl: evolutionUrl || 'UNDEFINED',
      hasToken: !!token,
      instanceName: evolutionInstance,
      workspaceId
    });

    if (!evolutionUrl || !token) {
      console.error(`❌ [${messageId}] Missing credentials:`, {
        evolutionUrl: evolutionUrl || 'MISSING',
        token: token ? 'EXISTS' : 'MISSING'
      });
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing Evolution API credentials'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    console.log(`📤 [${messageId}] Sending message via Evolution API:`, { 
      evolutionInstance, 
      messageType, 
      phoneNumber: phoneNumber?.substring(0, 8) + '***',
      hasFile: !!fileUrl
    });

    // Validações de entrada aprimoradas
    if (!phoneNumber) {
      return new Response(JSON.stringify({
        success: false,
        error: 'phoneNumber is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!content && !fileUrl) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Either content or fileUrl is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Configurar endpoint e payload baseado no tipo de mensagem
    let endpoint: string;
    let payload: any;

    const evolutionEndpoint = messageType === 'text' 
      ? `${evolutionUrl}/message/sendText/${evolutionInstance}`
      : `${evolutionUrl}/message/sendMedia/${evolutionInstance}`;

    if (messageType === 'text') {
      endpoint = evolutionEndpoint;
      payload = {
        number: phoneNumber,
        text: content
      };
    } else {
      endpoint = evolutionEndpoint;
      
      // Para mídia, verificar se temos URL ou precisamos enviar base64
      if (fileUrl) {
        let processedFileUrl = fileUrl;
        
        // Check if the URL is from Supabase Storage and needs processing
        if (fileUrl.includes('supabase.co/storage/v1/object/public/')) {
          console.log(`🔄 [${messageId}] Processing Supabase Storage URL through media processor`);
          
          try {
            // Call n8n-media-processor to handle the Supabase Storage URL
            const mediaProcessorResponse = await supabase.functions.invoke('n8n-media-processor', {
              body: {
                messageId: messageId,
                fileUrl: fileUrl,
                fileName: fileName,
                mimeType: messageType === 'image' ? 'image/jpeg' : 'application/octet-stream',
                direction: 'outbound'
              }
            });

            if (mediaProcessorResponse.error) {
              console.error(`❌ [${messageId}] Media processor error:`, mediaProcessorResponse.error);
              return new Response(JSON.stringify({
                success: false,
                error: 'Failed to process media file',
                details: mediaProcessorResponse.error
              }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              });
            }

            // Verificar estrutura de retorno
            const processedUrl = mediaProcessorResponse.data?.fileUrl || 
                                mediaProcessorResponse.data?.data?.publicUrl;
            
            if (processedUrl) {
              processedFileUrl = processedUrl;
              console.log(`✅ [${messageId}] Media processed successfully: ${processedUrl}`);
            } else {
              console.log(`⚠️ [${messageId}] Media processor didn't return processed URL, using original`);
            }
          } catch (processorError) {
            console.error(`❌ [${messageId}] Error calling media processor:`, processorError);
            // Continue with original URL as fallback
            console.log(`🔄 [${messageId}] Falling back to original URL`);
          }
        }

        payload = {
          number: phoneNumber,
          mediaMessage: {
            mediatype: messageType,
            media: processedFileUrl,
            caption: content || '',
            fileName: fileName || `file_${Date.now()}`
          }
        };
      } else {
        return new Response(JSON.stringify({
          success: false,
          error: 'File URL is required for media messages'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log(`🌐 [${messageId}] Calling Evolution API:`, { 
      endpoint: endpoint.replace(token, '[TOKEN]'), 
      messageType,
      hasPayload: !!payload
    });

    // Chamar Evolution API com timeout e retry
    const evolutionResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': token
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20000) // 20 segundos timeout
    });

    const responseData = await evolutionResponse.json();

    if (!evolutionResponse.ok) {
      console.error(`❌ [${messageId}] Evolution API error (${evolutionResponse.status}):`, responseData);
      return new Response(JSON.stringify({
        success: false,
        error: `Evolution API error: ${responseData.message || responseData.error || 'Unknown error'}`,
        status: evolutionResponse.status,
        details: responseData
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se a resposta indica erro mesmo com status 200
    if (responseData.error || responseData.success === false) {
      console.error(`❌ [${messageId}] Evolution API returned error:`, responseData);
      return new Response(JSON.stringify({
        success: false,
        error: 'Evolution API processing failed',
        details: responseData
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`✅ [${messageId}] Message sent successfully via Evolution API:`, {
      messageId: responseData.key?.id,
      status: responseData.status
    });

    // Salvar evolution_key_id no banco de dados para permitir ACKs futuros
    if (responseData.key?.id) {
      const searchBy = external_id || messageId;
      const searchColumn = external_id ? 'external_id' : 'id';
      
      console.log(`🔍 [${messageId}] Procurando mensagem por ${searchColumn}: ${searchBy}`);
      
      const { error: updateError } = await supabase
        .from('messages')
        .update({ 
          evolution_key_id: responseData.key.id,
          status: 'sent'
        })
        .eq(searchColumn, searchBy);

      if (updateError) {
        console.error(`⚠️ [${messageId}] Failed to save evolution_key_id:`, updateError);
      } else {
        console.log(`💾 [${messageId}] evolution_key_id saved: ${responseData.key.id} (found by ${searchColumn}: ${searchBy})`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      method: 'evolution_direct',
      data: responseData,
      messageId: messageId
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`❌ Error in send-evolution-message:`, error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});