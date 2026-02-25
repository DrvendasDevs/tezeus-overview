import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, range, cache-control',
  'Access-Control-Allow-Methods': 'GET, OPTIONS, HEAD',
  'Access-Control-Expose-Headers': 'content-length, content-range, accept-ranges',
  'Access-Control-Max-Age': '86400', // 24 hours
}

serve(async (req) => {
  // Enhanced CORS preflight handling
  if (req.method === 'OPTIONS') {
    console.log('🔄 CORS preflight request received');
    return new Response(null, { 
      status: 200,
      headers: corsHeaders 
    });
  }

  // Handle HEAD requests for metadata
  if (req.method === 'HEAD') {
    console.log('📋 HEAD request received');
    return new Response(null, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/octet-stream'
      }
    });
  }

  try {
    const url = new URL(req.url)
    const pathname = url.pathname.replace('/serve-local-media', '')
    
    // Extract path parts
    const pathParts = pathname.split('/').filter(Boolean)
    
    // Support two formats:
    // 1. /messages/{messageId}/{fileName}
    // 2. /messages/{fileName}
    if (pathParts.length < 2 || pathParts[0] !== 'messages') {
      return new Response('Invalid path', { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    let storagePath: string
    let fileName: string
    
    if (pathParts.length === 2) {
      // Format: /messages/{fileName}
      fileName = decodeURIComponent(pathParts[1])
      storagePath = `messages/${fileName}`
    } else {
      // Format: /messages/{messageId}/{fileName}
      const messageId = pathParts[1]
      fileName = decodeURIComponent(pathParts[2])
      storagePath = `messages/${messageId}/${fileName}`
    }
    
    console.log(`📂 Serving media: ${fileName}`)
    console.log(`🔍 Storage path: ${storagePath}`)
    console.log(`🌐 Request method: ${req.method}, URL: ${req.url}`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    try {
      // Try whatsapp-media bucket first (where n8n-media-processor stores files)
      let { data: fileData, error: downloadError } = await supabase.storage
        .from('whatsapp-media')
        .download(storagePath)

      // If not found in whatsapp-media, try chat-media bucket
      if (downloadError && downloadError.message?.includes('not found')) {
        console.log(`⚠️ File not found in whatsapp-media, trying chat-media bucket...`)
        const chatMediaResult = await supabase.storage
          .from('chat-media')
          .download(storagePath)
        fileData = chatMediaResult.data
        downloadError = chatMediaResult.error
      }

      if (downloadError || !fileData) {
        console.error('File not found in storage:', downloadError)
        return new Response('File not found', { 
          status: 404, 
          headers: corsHeaders 
        })
      }

      // Get file extension to determine content type
      const extension = fileName.split('.').pop()?.toLowerCase()
      let contentType = 'application/octet-stream'
      
      if (extension === 'jpg' || extension === 'jpeg') contentType = 'image/jpeg'
      else if (extension === 'png') contentType = 'image/png'
      else if (extension === 'gif') contentType = 'image/gif'
      else if (extension === 'webp') contentType = 'image/webp'
      else if (extension === 'mp4') contentType = 'video/mp4'
      else if (extension === 'ogg') contentType = 'audio/ogg'
      else if (extension === 'mp3') contentType = 'audio/mp3'
      else if (extension === 'pdf') contentType = 'application/pdf'
      else if (extension === 'doc' || extension === 'docx') contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      else if (extension === 'xls' || extension === 'xlsx') contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

      const fileBuffer = await fileData.arrayBuffer()
      
      console.log(`✅ File found and served: ${fileName} (${fileBuffer.byteLength} bytes, ${contentType})`)
      
      return new Response(fileBuffer, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
          'Content-Length': fileBuffer.byteLength.toString(),
          'Accept-Ranges': 'bytes',
          'Last-Modified': new Date().toUTCString(),
          'ETag': `"${storagePath.replace(/\//g, '-')}"`,
          'Content-Disposition': `inline; filename="${fileName}"`
        }
      })
    } catch (error) {
      console.error('Error serving file:', error)
      return new Response('Internal server error', { 
        status: 500, 
        headers: corsHeaders 
      })
    }

  } catch (error) {
    console.error('Serve media error:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to serve media',
        details: error instanceof Error ? error.message : String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})