import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Cache-Control': 'public, max-age=31536000',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messageId, mediaUrl, fileName, mimeType } = await req.json()

    if (!messageId || !mediaUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing messageId or mediaUrl' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`Processing media proxy for message ${messageId}: ${mediaUrl}`)

    // Lista de MIME types seguros suportados pelo Supabase Storage
    const SAFE_MIME_TYPES = {
      'image/jpeg': { extension: 'jpeg', mimeType: 'image/jpeg' },
      'image/jpg': { extension: 'jpeg', mimeType: 'image/jpeg' },
      'image/png': { extension: 'png', mimeType: 'image/png' },
      'image/gif': { extension: 'gif', mimeType: 'image/gif' },
      'image/webp': { extension: 'webp', mimeType: 'image/webp' },
      'application/pdf': { extension: 'pdf', mimeType: 'application/pdf' },
      'audio/mpeg': { extension: 'mp3', mimeType: 'audio/mpeg' },
      'audio/ogg': { extension: 'ogg', mimeType: 'audio/ogg' },
      'audio/wav': { extension: 'wav', mimeType: 'audio/wav' },
      'video/mp4': { extension: 'mp4', mimeType: 'video/mp4' },
      'video/webm': { extension: 'webm', mimeType: 'video/webm' },
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { extension: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { extension: 'xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    }

    // Detectar e validar MIME type seguro
    const detectSafeMimeType = async (mimeType: string | undefined, fileName: string | undefined, mediaResponse?: Response) => {
      console.log(`Input mimeType: ${mimeType}, fileName: ${fileName}`)
      
      type SafeMimeTypeKey = keyof typeof SAFE_MIME_TYPES;
      const isSafeMimeType = (type: string): type is SafeMimeTypeKey => {
        return type in SAFE_MIME_TYPES;
      };
      
      // 1. Tentar usar Content-Type da resposta HTTP se disponível
      if (mediaResponse) {
        const responseContentType = mediaResponse.headers.get('Content-Type')
        if (responseContentType && isSafeMimeType(responseContentType)) {
          console.log(`Using Content-Type from response: ${responseContentType}`)
          return SAFE_MIME_TYPES[responseContentType]
        }
      }

      // 2. Usar mimeType fornecido se for seguro
      if (mimeType && isSafeMimeType(mimeType)) {
        console.log(`Using provided mimeType: ${mimeType}`)
        return SAFE_MIME_TYPES[mimeType]
      }

      // 3. Detectar por extensão do arquivo
      if (fileName) {
        const lastDot = fileName.lastIndexOf('.')
        if (lastDot > -1) {
          const extension = fileName.substring(lastDot + 1).toLowerCase()
          
          const extensionMapping: Record<string, keyof typeof SAFE_MIME_TYPES> = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg', 
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'pdf': 'application/pdf',
            'mp3': 'audio/mpeg',
            'ogg': 'audio/ogg',
            'wav': 'audio/wav',
            'mp4': 'video/mp4',
            'webm': 'video/webm',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          }

          if (extensionMapping[extension]) {
            const safeMimeType = extensionMapping[extension]
            console.log(`Detected mimeType from extension .${extension}: ${safeMimeType}`)
            return SAFE_MIME_TYPES[safeMimeType]
          }
        }
      }

      // 4. Fallback baseado no tipo de mídia (assumir JPEG para imagens)
      const urlLower = (fileName || '').toLowerCase()
      if (urlLower.includes('image') || urlLower.includes('photo') || urlLower.includes('picture')) {
        console.log('Fallback to image/jpeg for image-like content')
        return SAFE_MIME_TYPES['image/jpeg']
      }
      if (urlLower.includes('audio') || urlLower.includes('sound')) {
        console.log('Fallback to audio/mpeg for audio-like content') 
        return SAFE_MIME_TYPES['audio/mpeg']
      }
      if (urlLower.includes('video')) {
        console.log('Fallback to video/mp4 for video-like content')
        return SAFE_MIME_TYPES['video/mp4']
      }

      // 5. Se não conseguir detectar, rejeitar com erro
      throw new Error(`Unsupported media type. mimeType: ${mimeType}, fileName: ${fileName}. Only images, audio and video are supported.`)
    }

    // Download media first to get response headers for better MIME detection
    console.log(`Downloading media from: ${mediaUrl}`)
    
    // Retry logic para downloads mais robustos
    let mediaResponse;
    let lastError;
    const maxRetries = 3;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`Download attempt ${attempt}/${maxRetries}`)
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      
      try {
        mediaResponse = await fetch(mediaUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'WhatsApp/2.22.24.81 A',
            'Accept': 'image/webp,image/jpeg,image/png,video/mp4,audio/mpeg,*/*',
            'Accept-Encoding': 'identity',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (mediaResponse.ok) {
          console.log(`✅ Download successful on attempt ${attempt}`)
          break; // Sucesso, sair do loop
        } else {
          lastError = new Error(`HTTP ${mediaResponse.status}: ${mediaResponse.statusText}`)
          console.warn(`⚠️ Attempt ${attempt} failed with status ${mediaResponse.status}`)
        }
        
      } catch (fetchError) {
        clearTimeout(timeoutId);
        lastError = fetchError instanceof Error ? fetchError : new Error(String(fetchError));
        
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.warn(`⚠️ Attempt ${attempt} timed out after 60 seconds`)
          lastError = new Error(`Download timeout after 60 seconds`)
        } else {
          const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
          console.warn(`⚠️ Attempt ${attempt} failed: ${errorMsg}`)
        }
        
        // Se não é a última tentativa, esperar antes do retry
        if (attempt < maxRetries) {
          const delay = attempt * 1000; // 1s, 2s, 3s
          console.log(`Waiting ${delay}ms before retry...`)
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // Se chegou aqui sem sucesso, lançar o último erro
    if (!mediaResponse || !mediaResponse.ok) {
      throw new Error(`Failed to download after ${maxRetries} attempts. Last error: ${lastError?.message || 'Unknown error'}`)
    }

    if (!mediaResponse.ok) {
      console.error(`Download failed: ${mediaResponse.status} ${mediaResponse.statusText}`)
      console.error(`Response headers: ${JSON.stringify(Object.fromEntries(mediaResponse.headers))}`)
      throw new Error(`Failed to download media: ${mediaResponse.status} ${mediaResponse.statusText}`)
    }

    // Detectar MIME type seguro usando resposta HTTP
    const { extension: fileExtension, mimeType: finalMimeType } = await detectSafeMimeType(mimeType, fileName, mediaResponse)
    console.log(`Final MIME type: ${finalMimeType}, extension: ${fileExtension}`)

    // Gerar nome do arquivo simplificado
    let localFileName
    if (fileName) {
      // Manter nome original se já tem extensão válida
      const hasValidExtension = /\.(jpg|jpeg|png|gif|webp|mp3|ogg|wav|mp4|webm)$/i.test(fileName)
      if (hasValidExtension) {
        localFileName = fileName
        console.log(`Using existing fileName with extension: ${fileName}`)
      } else {
        localFileName = `${fileName}.${fileExtension}`
        console.log(`Adding extension to fileName: ${fileName} -> ${localFileName}`)
      }
    } else {
      // Gerar nome automaticamente apenas com timestamp
      localFileName = `${Date.now()}.${fileExtension}`
      console.log(`Generated fileName: ${localFileName}`)
    }
    const storagePath = localFileName
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Definir caminho na pasta messages dentro do bucket whatsapp-media
    const storagePathWithFolder = `messages/${storagePath}`
    
    // Check if file already exists in Supabase Storage
    try {
      const { data: existingFile } = await supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(storagePathWithFolder)
      
      if (existingFile?.publicUrl) {
        // Verify if file actually exists by trying to download it
        const { data: testData, error: testError } = await supabase.storage
          .from('whatsapp-media')
          .download(storagePathWithFolder)
        
        if (!testError && testData) {
          console.log(`File already exists in storage: ${existingFile.publicUrl}`)
          return new Response(
            JSON.stringify({ 
              publicUrl: existingFile.publicUrl,
              storagePath: storagePathWithFolder,
              isLocal: true
            }),
            { 
              status: 200, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
        }
      }
    } catch (localCheckError) {
      console.log('File not found in storage, proceeding with download')
    }

    const mediaBlob = await mediaResponse.blob()
    const downloadedSize = mediaBlob.size
    console.log(`Downloaded ${downloadedSize} bytes of ${finalMimeType}`)

    // Validação de integridade do conteúdo
    if (downloadedSize === 0) {
      throw new Error(`Downloaded file is empty (0 bytes). URL may be invalid or expired: ${mediaUrl}`)
    }

    // Validação básica de tamanho mínimo por tipo
    const minSizes: Record<string, number> = {
      'image/jpeg': 100,
      'image/png': 100, 
      'image/gif': 100,
      'image/webp': 100,
      'audio/mpeg': 1000,
      'audio/ogg': 1000,
      'video/mp4': 1000,
      'video/webm': 1000
    }

    const minSize = minSizes[finalMimeType] || 50
    if (downloadedSize < minSize) {
      console.warn(`Downloaded file seems too small (${downloadedSize} bytes) for ${finalMimeType}, minimum expected: ${minSize} bytes`)
    }

    // Validar MIME type final antes do upload
    if (!finalMimeType || finalMimeType === 'application/octet-stream') {
      throw new Error(`Invalid MIME type detected: ${finalMimeType}. Upload aborted to prevent storage errors.`)
    }

    // Validação básica de headers de conteúdo
    const contentLength = mediaResponse.headers.get('Content-Length')
    if (contentLength && parseInt(contentLength) !== downloadedSize) {
      console.warn(`Content-Length header (${contentLength}) doesn't match downloaded size (${downloadedSize})`)
    }
    
    console.log(`Using validated MIME type: ${finalMimeType}, content verified: ${downloadedSize} bytes`)

    // Save to Supabase Storage
    try {
      console.log(`Saving ${mediaBlob.size} bytes to Supabase Storage: ${storagePathWithFolder}`)
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(storagePathWithFolder, mediaBlob, {
          contentType: finalMimeType,
          upsert: true
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        throw new Error(`Failed to upload to storage: ${uploadError.message}`)
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(storagePathWithFolder)

      console.log(`Media saved successfully to storage: ${publicUrlData.publicUrl}`)

      return new Response(
        JSON.stringify({ 
          publicUrl: publicUrlData.publicUrl,
          storagePath: storagePathWithFolder,
          isLocal: true,
          size: mediaBlob.size,
          mimeType: finalMimeType
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    } catch (saveError) {
      console.error('Failed to save media to storage:', saveError)
      throw new Error(`Failed to save media: ${saveError instanceof Error ? saveError.message : String(saveError)}`)
    }

  } catch (error) {
    console.error('Media proxy error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to proxy media',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})