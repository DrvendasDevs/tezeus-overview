import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileUrl, fileName, conversationId } = await req.json();
    
    console.log('📁 Processando upload de mídia:', { fileName, conversationId });

    if (!fileUrl) {
      throw new Error('URL do arquivo é obrigatória');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Download do arquivo com headers adequados
    console.log('⬇️ Fazendo download do arquivo:', fileUrl);
    const response = await fetch(fileUrl, {
      headers: {
        'User-Agent': 'WhatsApp/2.22.24.81 A',
        'Accept': 'image/webp,image/jpeg,image/png,video/mp4,audio/mpeg,*/*',
        'Accept-Encoding': 'identity'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erro ao baixar arquivo: ${response.status} ${response.statusText}`);
    }

    // Converter para blob para garantir binário real
    const blob = await response.blob();
    
    // Determinar MIME type correto
    let finalMimeType = response.headers.get('content-type') || blob.type;
    
    // Se ainda for genérico, tentar detectar por extensão do fileName
    if (!finalMimeType || finalMimeType === 'application/octet-stream') {
      if (fileName && fileName.includes('.')) {
        const ext = fileName.split('.').pop()?.toLowerCase();
        const extMap: { [key: string]: string } = {
          'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
          'gif': 'image/gif', 'webp': 'image/webp', 'mp4': 'video/mp4',
          'mov': 'video/quicktime', 'mp3': 'audio/mpeg', 'ogg': 'audio/ogg'
        };
        finalMimeType = extMap[ext || ''] || 'application/octet-stream';
      } else {
        finalMimeType = 'application/octet-stream';
      }
    }
    
    console.log(`📦 Arquivo baixado: ${blob.size} bytes, tipo: ${finalMimeType}`);
    console.log(`📋 Response headers - Content-Type: ${response.headers.get('content-type')}, Content-Length: ${response.headers.get('content-length')}`);

    // Validar se o arquivo foi baixado corretamente
    if (blob.size === 0) {
      throw new Error('Arquivo baixado está vazio (0 bytes)');
    }

    // Gerar nome único com extensão correta
    const extension = finalMimeType.split('/')[1] || 'bin';
    const uniqueFileName = fileName || `upload_${Date.now()}_${Math.random().toString(36).substring(7)}.${extension}`;

    // Upload para Supabase Storage com contentType correto
    console.log(`📝 Upload details: fileName=${uniqueFileName}, contentType=${finalMimeType}, size=${blob.size}`);
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(`messages/${uniqueFileName}`, blob, {
        contentType: finalMimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error('❌ Erro no upload:', uploadError);
      throw new Error(`Erro no upload: ${uploadError.message}`);
    }

    // Gerar URL através da edge function serve-local-media
    const finalPath = `messages/${uniqueFileName}`;
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const proxyUrl = `${supabaseUrl}/functions/v1/serve-local-media/${finalPath}`;

    console.log('✅ Arquivo salvo:', proxyUrl);
    console.log(`✅ Upload confirmado - Path: ${finalPath}, MIME: ${finalMimeType}`);

    return new Response(JSON.stringify({
      success: true,
      publicUrl: proxyUrl,
      fileName: uniqueFileName,
      mimeType: finalMimeType,
      size: blob.size,
      storagePath: finalPath
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro no upload:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});