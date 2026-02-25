import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const mimeToExtensionMap: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/aac': 'aac',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/amr': 'amr'
};

let ffmpegModulePromise: Promise<any> | null = null;
let ffmpegInstance: any | null = null;

async function getFfmpegInstance() {
  if (!ffmpegModulePromise) {
    ffmpegModulePromise = import('https://esm.sh/@ffmpeg/ffmpeg@0.12.10?target=deno');
  }
  const { createFFmpeg } = await ffmpegModulePromise;

  if (!ffmpegInstance) {
    ffmpegInstance = createFFmpeg({
      log: false,
      corePath: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/ffmpeg-core.js'
    });
  }

  if (!ffmpegInstance.isLoaded()) {
    await ffmpegInstance.load();
  }

  return ffmpegInstance;
}

function getExtensionFromMime(mime?: string | null) {
  if (!mime) return 'bin';
  const cleanMime = mime.split(';')[0].trim().toLowerCase();
  return mimeToExtensionMap[cleanMime] || 'bin';
}

async function convertAudioToMp3(buffer: Uint8Array, sourceMime?: string | null) {
  try {
    const ffmpeg = await getFfmpegInstance();
    const inputExtension = getExtensionFromMime(sourceMime);
    const inputFile = `input.${inputExtension}`;
    const outputFile = 'output.mp3';

    ffmpeg.FS('writeFile', inputFile, buffer);
    await ffmpeg.run('-y', '-i', inputFile, '-vn', '-ar', '44100', '-ac', '2', '-b:a', '128k', outputFile);
    const convertedData = ffmpeg.FS('readFile', outputFile);

    try {
      ffmpeg.FS('unlink', inputFile);
      ffmpeg.FS('unlink', outputFile);
    } catch (_) {
      // Ignore cleanup errors
    }

    return new Uint8Array(convertedData);
  } catch (error) {
    console.error('❌ [n8n-media-processor] Falha ao converter áudio para MP3:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log('N8N Media Processor - Payload recebido:', payload);
    
    // 🔍 VALIDAÇÃO CRÍTICA: Verificar se é um evento de mensagem
    const eventType = payload?.event || payload?.body?.event;
    
    // Se não for evento de mensagem (ex: contacts.update), retornar sucesso sem processar
    if (eventType && !eventType.includes('messages')) {
      console.log(`⏭️ Evento ${eventType} ignorado - n8n-media-processor processa apenas eventos de mensagens`);
      return new Response(JSON.stringify({
        success: true,
        skipped: true,
        reason: `Evento ${eventType} não requer processamento de mídia`,
        event: eventType
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Mapear campos do N8N e evolution-webhook-v2 para os campos esperados pela função
    const {
      // Campos diretos do evolution-webhook-v2
      messageId: directMessageId,
      fileUrl: directFileUrl,
      mediaUrl: directMediaUrl,
      base64: directBase64,
      fileName: directFileName,
      mimeType: directMimeType,
      conversationId: directConversationId,
      phoneNumber: directPhoneNumber,
      workspaceId: directWorkspaceId,
      messageType: directMessageType,
      contactId: directContactId,
      metadata: directMetadata,
      
      // Campos do N8N (mapeamento - snake_case)
      external_id,
      content,
      file_name,
      file_url, // 🔧 CRÍTICO: campo que vem do N8N em snake_case
      mime_type,
      workspace_id,
      connection_id,
      contact_name,
      sender_type,
      message_type,
      phone_number,
      direction
    } = payload;
    
    // Priorizar campos diretos do evolution-webhook-v2, depois mapear do N8N
    const messageId = directMessageId || external_id;
    const mediaUrl = directFileUrl || directMediaUrl || file_url; // 🔧 fileUrl camelCase OU file_url snake_case do N8N
    const base64 = directBase64 || content;
    const fileName = directFileName || file_name;
    const mimeType = directMimeType || mime_type;
    const conversationId = directConversationId;
    const phoneNumber = directPhoneNumber || phone_number;
    const workspaceId = directWorkspaceId || workspace_id;
    const messageType = directMessageType || message_type;
    const contactId = directContactId;
    const metadata = directMetadata;
    const messageDirection = direction;
    
    console.log('N8N Media Processor - Dados mapeados:', { 
      messageId, 
      hasMediaUrl: !!mediaUrl, 
      hasBase64: !!base64, 
      fileName, 
      mimeType, 
      workspaceId,
      conversationId,
      messageType,
      contactId,
      phoneNumber,
      direction: messageDirection,
      sender_type,
      metadata
    });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // VALIDAÇÃO: messageId é obrigatório
    if (!messageId) {
      console.log('❌ Sem messageId - não é possível processar');
      return new Response(JSON.stringify({
        success: false,
        error: 'messageId obrigatório para processamento'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // VALIDAÇÃO: Se não há dados de mídia (base64 ou mediaUrl), retornar sucesso sem processar
    if (!base64 && !mediaUrl) {
      console.log('⚠️ Nenhum dado de mídia encontrado - pulando processamento');
      return new Response(JSON.stringify({
        success: true,
        message: 'Nenhum dado de mídia para processar - mensagem de texto simples',
        messageId: messageId
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const isOutbound = messageDirection === 'outbound' || sender_type === 'agent';
    console.log(`🔄 Processando mensagem ${isOutbound ? 'OUTBOUND' : 'INBOUND'} - external_id: ${messageId}`);
    console.log(`📋 Direction: ${messageDirection}, Sender Type: ${sender_type}, Is Outbound: ${isOutbound}`);

    console.log('🔍 Buscando mensagem existente por messageId:', messageId);
    
    // Detectar se messageId é UUID ou external_id
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId);
    
    let existingMessage;
    let searchError;
    
    if (isUUID) {
      // Buscar por ID (UUID)
      console.log('📌 messageId é UUID válido, buscando por id');
      const result = await supabase
        .from('messages')
        .select('id, external_id, workspace_id, content, conversation_id, message_type')
        .eq('id', messageId)
        .maybeSingle();
      existingMessage = result.data;
      searchError = result.error;
    } else {
      // Buscar por external_id (string alfanumérica curta do WhatsApp)
      console.log('📌 messageId não é UUID, buscando por external_id');
      const result = await supabase
        .from('messages')
        .select('id, external_id, workspace_id, content, conversation_id, message_type')
        .eq('external_id', messageId)
        .maybeSingle();
      existingMessage = result.data;
      searchError = result.error;
    }

    if (searchError) {
      console.error('❌ Erro ao buscar mensagem:', searchError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Erro ao buscar mensagem existente',
        details: searchError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!existingMessage) {
      console.log(`❌ Mensagem não encontrada - messageId:`, messageId);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Mensagem não encontrada no banco de dados',
        messageId: messageId,
        details: 'A mensagem deve ser criada pelo evolution-webhook-v2 antes de processar a mídia'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`✅ Mensagem encontrada: ${existingMessage.id}`);

    // Preparar bytes a partir de base64 ou URL para mensagens de mídia
    let uint8Array: Uint8Array;
    
    if (base64) {
      try {
        // Suporta formatos: "<puro base64>" ou "data:<mime>;base64,<dados>"
        let base64Data = base64 as string;
        const dataUrlMatch = /^data:([^;]+);base64,(.*)$/i.exec(base64Data);
        if (dataUrlMatch) {
          base64Data = dataUrlMatch[2];
        }
        const decoded = atob(base64Data);
        const bytes = new Uint8Array(decoded.length);
        for (let i = 0; i < decoded.length; i++) {
          bytes[i] = decoded.charCodeAt(i);
        }
        uint8Array = bytes;
        console.log('Decodificado base64 - Tamanho:', uint8Array.length, 'bytes');
      } catch (e) {
        throw new Error(`Base64 inválido: ${e instanceof Error ? e.message : String(e)}`);
      }
    } else if (mediaUrl) {
      // Baixar mídia com headers adequados
      console.log('Baixando mídia de:', mediaUrl);
      const response = await fetch(mediaUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; TelegramBot)',
          'Accept': '*/*'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Falha ao baixar mídia: ${response.status} ${response.statusText}`);
      }

      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();
      uint8Array = new Uint8Array(arrayBuffer);
    } else {
      throw new Error('Nenhuma fonte de mídia fornecida (base64 ou mediaUrl)');
    }
    
    // Validar se o arquivo foi obtido corretamente
    if (uint8Array.length === 0) {
      throw new Error('Arquivo obtido está vazio');
    }
    
    console.log('Arquivo obtido com sucesso - Tamanho:', uint8Array.length, 'bytes');

    // Função para normalizar MIME types
    function normalizeMimeType(mimeType: string): { mime: string; extension: string } {
      // Remover espaços e parâmetros extras (como codecs)
      const cleanMime = mimeType.split(';')[0].trim();
      
      // Mapear para tipos aceitos pelo Supabase Storage
      const mimeMap: Record<string, { mime: string; extension: string }> = {
        // Áudios OGG convertidos para MP3 (formato universal)
        'audio/ogg': { mime: 'audio/mpeg', extension: 'mp3' },
        'audio/mpeg': { mime: 'audio/mpeg', extension: 'mp3' },
        'audio/mp3': { mime: 'audio/mpeg', extension: 'mp3' },
        'audio/wav': { mime: 'audio/wav', extension: 'wav' },
        'audio/webm': { mime: 'audio/webm', extension: 'webm' },
        'image/jpeg': { mime: 'image/jpeg', extension: 'jpg' },
        'image/jpg': { mime: 'image/jpeg', extension: 'jpg' },
        'image/png': { mime: 'image/png', extension: 'png' },
        'image/webp': { mime: 'image/webp', extension: 'webp' },
        'video/mp4': { mime: 'video/mp4', extension: 'mp4' },
        'video/webm': { mime: 'video/webm', extension: 'webm' },
        'application/pdf': { mime: 'application/pdf', extension: 'pdf' },
      };
      
      return mimeMap[cleanMime] || { mime: 'application/octet-stream', extension: 'bin' };
    }

    // Função para detectar MIME type baseado no conteúdo (magic numbers)
    function detectMimeTypeFromBuffer(buffer: Uint8Array): string | null {
      const header = Array.from(buffer.slice(0, 12)).map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Imagens
      if (header.startsWith('ffd8ff')) return 'image/jpeg';
      if (header.startsWith('89504e47')) return 'image/png';
      if (header.startsWith('47494638')) return 'image/gif';
      if (header.startsWith('52494646') && header.includes('57454250')) return 'image/webp';
      
      // Vídeos
      if (header.includes('667479706d703432') || header.includes('667479706d703431')) return 'video/mp4';
      if (header.includes('6674797069736f6d')) return 'video/mp4';
      if (header.includes('667479703367703')) return 'video/3gpp';
      if (header.startsWith('1a45dfa3')) return 'video/webm';
      if (header.includes('667479707174')) return 'video/quicktime';
      
      // Áudios  
      if (header.startsWith('494433') || header.startsWith('fff3') || header.startsWith('fff2')) return 'audio/mpeg';
      if (header.startsWith('4f676753')) return 'audio/ogg';
      if (header.startsWith('52494646') && header.includes('57415645')) return 'audio/wav';
      if (header.includes('667479704d344120')) return 'audio/mp4';
      
      // Documentos
      if (header.startsWith('25504446')) return 'application/pdf';
      
      // Office Documents
      if (header.startsWith('504b0304')) {
        // ZIP-based formats (DOCX, XLSX, PPTX)
        return 'application/octet-stream'; // Will be refined by extension
      }
      
      // Verificar se é texto (UTF-8/ASCII) pela ausência de bytes de controle
      const isTextContent = buffer.slice(0, 100).every(byte => 
        (byte >= 32 && byte <= 126) || // ASCII printable
        byte === 9 || byte === 10 || byte === 13 || // Tab, LF, CR
        (byte >= 128 && byte <= 255) // UTF-8 extended
      );
      
      if (isTextContent) {
        const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer.slice(0, 100));
        // Detectar XML por estrutura
        if (text.includes('<?xml') || text.includes('<') && text.includes('>')) {
          return 'application/xml';
        }
        // Texto puro
        return 'text/plain';
      }
      
      return null;
    }

    // Função para detectar MIME type correto baseado na extensão
    function getMimeTypeByExtension(filename: string): string {
      const ext = filename.toLowerCase().split('.').pop() || '';
      const mimeMap: { [key: string]: string } = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif', 'webp': 'image/webp',
        'mp4': 'video/mp4', 'mov': 'video/quicktime', 'avi': 'video/x-msvideo', 'webm': 'video/webm', '3gp': 'video/3gpp',
        'mp3': 'audio/mpeg', 'ogg': 'audio/ogg', 'wav': 'audio/wav', 'm4a': 'audio/mp4', 'aac': 'audio/aac',
        'pdf': 'application/pdf', 
        'doc': 'application/msword', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel', 'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint', 'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'txt': 'text/plain', 'xml': 'application/xml', 'json': 'application/json'
      };
      return mimeMap[ext] || 'application/octet-stream';
    }

    // Detectar MIME type final
    let detectedMimeType = detectMimeTypeFromBuffer(uint8Array);
    let rawMimeType = detectedMimeType || mimeType || 'application/octet-stream';
    
    console.log('🔍 MIME Type antes da normalização:', {
      fromPayload: mimeType,
      fromBuffer: detectedMimeType,
      rawMimeTypeUsed: rawMimeType
    });

    let sanitizedMimeType = rawMimeType.split(';')[0].trim().toLowerCase();
    if (!sanitizedMimeType) {
      sanitizedMimeType = 'application/octet-stream';
    }
    rawMimeType = sanitizedMimeType;

    const normalizedMessageType = (messageType || existingMessage.message_type || '').toLowerCase();
    const isAudioMessage = rawMimeType.startsWith('audio/') || normalizedMessageType === 'audio' || normalizedMessageType === 'ptt';
    let audioConversionDetails: Record<string, string> | null = null;

    if (isAudioMessage) {
      const shouldConvertToMp3 = rawMimeType !== 'audio/mpeg';
      if (shouldConvertToMp3) {
        console.log('🎯 Convertendo áudio para MP3 para armazenamento consistente...');
        const convertedBuffer = await convertAudioToMp3(uint8Array, rawMimeType);
        if (convertedBuffer) {
          uint8Array = convertedBuffer;
          rawMimeType = 'audio/mpeg';
          audioConversionDetails = {
            from: sanitizedMimeType,
            to: rawMimeType,
            strategy: 'ffmpeg-mp3',
            converted_at: new Date().toISOString()
          };
        } else {
          console.warn('⚠️ Conversão de áudio falhou, mantendo formato original');
        }
      }
    }
    
    // CRÍTICO: Sempre normalizar o MIME type para tipos aceitos pelo Supabase Storage
    const { mime: finalMimeType, extension: defaultExtension } = normalizeMimeType(rawMimeType);
    
    console.log('✅ MIME Type após normalização:', {
      original: rawMimeType,
      normalized: finalMimeType,
      extension: defaultExtension
    });
    
    // SEMPRE usar a extensão do MIME normalizado (independente do fileName original)
    const fileExtension = defaultExtension;
    
    // Gerar nome único para evitar conflitos
    const timestamp = Date.now();
    const randomId = crypto.randomUUID().split('-')[0];
    
    // Extrair nome base sem extensão se fileName existir
    let baseName = 'media';
    if (fileName) {
      baseName = fileName.includes('.') 
        ? fileName.substring(0, fileName.lastIndexOf('.'))
        : fileName;
    }
    
    // SEMPRE usar a extensão do MIME normalizado
    const finalFileName = `${timestamp}_${randomId}_${baseName}.${fileExtension}`;
    const storagePath = `messages/${finalFileName}`;

    console.log('📤 Upload details (usando MIME normalizado):', {
      originalMimeType: rawMimeType,
      normalizedMimeType: finalMimeType,
      fileExtension,
      finalFileName,
      storagePath
    });

    // Upload para Supabase Storage usando o MIME type normalizado
    console.log('🚀 Iniciando upload com contentType:', finalMimeType);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('whatsapp-media')
      .upload(storagePath, uint8Array, {
        contentType: finalMimeType, // Já está normalizado (audio/ogg -> audio/webm)
        upsert: false
      });

    if (uploadError) {
      console.error('❌ Erro no upload:', uploadError);
      return new Response(JSON.stringify({
        success: false,
        error: `Erro no upload: ${uploadError.message}`
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Upload realizado com sucesso:', uploadData);

    // Obter URL através da edge function serve-local-media
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const proxyUrl = `${supabaseUrl}/functions/v1/serve-local-media/${storagePath}`;

    console.log('📨 Mensagem existente encontrada - atualizando mídia:', existingMessage.id);
    
    // APENAS UPDATE - nunca INSERT
    // Usar o ID da mensagem encontrada (UUID do banco)
    const { error: updateError } = await supabase
      .from('messages')
      .update({
        file_url: proxyUrl,
        mime_type: finalMimeType,
        file_name: finalFileName,
        metadata: {
          original_file_name: finalFileName,
          file_size: uint8Array.length,
          processed_at: new Date().toISOString(),
          ...(audioConversionDetails ? { audio_conversion: audioConversionDetails } : {})
        }
      })
      .eq('id', existingMessage.id);

    if (updateError) {
      console.error('❌ Erro ao atualizar mensagem:', updateError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Falha ao atualizar mensagem com mídia'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('✅ Mensagem atualizada com mídia via UPDATE:', existingMessage.id);
    return new Response(JSON.stringify({
      success: true,
      messageId: existingMessage.id,
      fileUrl: proxyUrl,
      action: 'updated_existing',
      fileName: finalFileName,
      mimeType: finalMimeType,
      fileSize: uint8Array.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro no processamento:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});