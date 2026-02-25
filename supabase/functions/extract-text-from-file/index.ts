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
    const formData = await req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      throw new Error('No file provided');
    }

    const fileName = file.name.toLowerCase();
    const fileType = file.type;
    
    console.log('Processing file:', fileName, 'Type:', fileType);

    let extractedText = '';

    // Arquivos de texto simples
    if (fileName.endsWith('.txt') || fileName.endsWith('.md') || fileType === 'text/plain' || fileType === 'text/markdown') {
      const text = await file.text();
      extractedText = text;
    }
    // PDF - usar pdf-parse
    else if (fileName.endsWith('.pdf') || fileType === 'application/pdf') {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Importar pdf-parse dinamicamente
      const pdfParse = (await import('https://esm.sh/pdf-parse@1.1.1')).default;
      
      try {
        const data = await pdfParse(uint8Array);
        extractedText = data.text;
      } catch (pdfError) {
        console.error('Error parsing PDF:', pdfError);
        throw new Error(`Failed to parse PDF: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`);
      }
    }
    // Arquivos Office (DOCX, XLSX, PPTX) - são arquivos ZIP, tentar extrair texto básico
    else if (fileName.endsWith('.docx') || fileName.endsWith('.xlsx') || fileName.endsWith('.pptx')) {
      // Para arquivos Office, vamos usar mammoth para DOCX
      if (fileName.endsWith('.docx')) {
        const arrayBuffer = await file.arrayBuffer();
        
        const mammoth = (await import('https://esm.sh/mammoth@1.6.0')).default;
        
        try {
          const result = await mammoth.extractRawText({ arrayBuffer });
          extractedText = result.value;
        } catch (docxError) {
          console.error('Error parsing DOCX:', docxError);
          throw new Error(`Failed to parse DOCX: ${docxError instanceof Error ? docxError.message : 'Unknown error'}`);
        }
      } else {
        // Para XLSX e PPTX, vamos informar que não são suportados ainda
        throw new Error('XLSX and PPTX files are not yet supported. Please use PDF or text files.');
      }
    }
    else {
      throw new Error(`Unsupported file type: ${fileType}. Supported formats: PDF, TXT, MD, DOCX`);
    }

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No text could be extracted from the file');
    }

    console.log('Text extracted successfully. Length:', extractedText.length);

    return new Response(
      JSON.stringify({ 
        success: true, 
        text: extractedText,
        fileSize: file.size,
        fileName: file.name,
        extractedLength: extractedText.length
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in extract-text-from-file:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
