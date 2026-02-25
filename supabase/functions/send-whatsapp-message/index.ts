import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendWithOptionalFallback } from '../_shared/whatsapp-providers.ts';

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
    const { 
      messageId, 
      phoneNumber, 
      content, 
      messageType = 'text', 
      fileUrl, 
      fileName, 
      evolutionInstance, 
      external_id, 
      workspaceId 
    } = requestBody;
    
    if (!workspaceId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'workspaceId is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log(`📤 [${messageId}] Sending WhatsApp message via provider adapter:`, { 
      messageType, 
      phoneNumber: phoneNumber?.substring(0, 8) + '***',
      hasFile: !!fileUrl,
      workspaceId
    });

    // Use adapter pattern para enviar a mensagem
    let result;
    
    if (messageType === 'text') {
      result = await sendWithOptionalFallback({
        workspaceId,
        to: phoneNumber,
        text: content,
        context: {
          instance: evolutionInstance,
          evolutionInstance: evolutionInstance
        }
      }, 'text', supabase);
    } else {
      // Media message
      if (!fileUrl) {
        return new Response(JSON.stringify({
          success: false,
          error: 'File URL is required for media messages'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Process Supabase Storage URLs if needed
      let processedFileUrl = fileUrl;
      
      if (fileUrl.includes('supabase.co/storage/v1/object/public/')) {
        console.log(`🔄 [${messageId}] Processing Supabase Storage URL through media processor`);
        
        try {
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
          } else {
            const processedUrl = mediaProcessorResponse.data?.fileUrl || 
                                mediaProcessorResponse.data?.data?.publicUrl;
            
            if (processedUrl) {
              processedFileUrl = processedUrl;
              console.log(`✅ [${messageId}] Media processed successfully`);
            }
          }
        } catch (processorError) {
          console.error(`❌ [${messageId}] Error calling media processor:`, processorError);
          // Continue with original URL as fallback
        }
      }

      result = await sendWithOptionalFallback({
        workspaceId,
        to: phoneNumber,
        mediaUrl: processedFileUrl,
        mediaType: messageType as 'image' | 'video' | 'audio' | 'document',
        caption: content,
        fileName: fileName,
        context: {
          instance: evolutionInstance,
          evolutionInstance: evolutionInstance
        }
      }, 'media', supabase);
    }

    if (!result.ok) {
      console.error(`❌ [${messageId}] Failed to send message:`, result.error);
      return new Response(JSON.stringify({
        success: false,
        error: result.error || 'Failed to send message via WhatsApp provider',
        details: 'Provider send operation failed'
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`✅ [${messageId}] Message sent successfully:`, {
      providerMsgId: result.providerMsgId
    });

    // Save external message ID to database if available
    if (result.providerMsgId && messageId) {
      const searchBy = external_id || messageId;
      const searchColumn = external_id ? 'external_id' : 'id';
      
      console.log(`🔍 [${messageId}] Updating message ${searchColumn}: ${searchBy}`);
      
      const { error: updateError } = await supabase
        .from('messages')
        .update({ 
          evolution_key_id: result.providerMsgId,
          status: 'sent'
        })
        .eq(searchColumn, searchBy);

      if (updateError) {
        console.error(`⚠️ [${messageId}] Failed to save message ID:`, updateError);
      } else {
        console.log(`💾 [${messageId}] Message ID saved: ${result.providerMsgId}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      providerMsgId: result.providerMsgId,
      failoverFrom: result.failoverFrom
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`❌ Error in send-whatsapp-message:`, error);
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
