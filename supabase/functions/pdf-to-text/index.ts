import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Edge Function: pdf-to-text
 * 
 * Recebe um PDF (via base64 ou URL) e extrai o texto.
 * 1. Tenta extração digital via unpdf (PDF com texto embutido)
 * 2. Se escaneado, usa OCR via OCR.space API (gratuita, suporta PDF)
 * 
 * Body JSON:
 *   - file_base64: string (PDF em base64)
 *   - file_url: string (URL do PDF para download)
 *   - ocr_enabled: boolean (default: true) - tentar OCR se PDF escaneado
 *   - language: string (default: 'por') - idioma para OCR
 *   - ocr_api_key: string (opcional) - chave da API OCR.space
 *   - min_text_length: number (default: 50) - mínimo chars para considerar digital
 *   - ocr_engine: number (default: 2) - engine OCR (1 ou 2, engine 2 é melhor para docs)
 */

async function extractDigitalText(pdfBytes: Uint8Array): Promise<{ text: string; pages: number; pageTexts: string[] }> {
  const { getDocumentProxy } = await import("https://esm.sh/unpdf@0.12.1");
  
  const pdf = await getDocumentProxy(new Uint8Array(pdfBytes));
  const totalPages = pdf.numPages;
  const pageTexts: string[] = [];
  let fullText = '';

  for (let i = 1; i <= totalPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .filter((item: any) => item.str !== undefined)
        .map((item: any) => item.str)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      pageTexts.push(pageText);
      fullText += (pageText ? pageText + '\n' : '');
    } catch (pageError) {
      console.warn(`⚠️ [PDF-to-Text] Erro ao processar página ${i}:`, pageError);
      pageTexts.push('');
    }
  }

  return { text: fullText.trim(), pages: totalPages, pageTexts };
}

async function extractOcrText(
  pdfBytes: Uint8Array,
  fileUrl: string | null,
  apiKey: string,
  language: string,
  ocrEngine: number
): Promise<{ text: string; pages: number; pageTexts: string[] }> {
  console.log(`🔍 [PDF-to-Text] Iniciando OCR via OCR.space (engine ${ocrEngine}, idioma: ${language})...`);

  const formData = new FormData();
  formData.append('apikey', apiKey);
  formData.append('language', language);
  formData.append('isOverlayRequired', 'false');
  formData.append('filetype', 'PDF');
  formData.append('OCREngine', String(ocrEngine));
  formData.append('isTable', 'true');
  formData.append('scale', 'true');

  if (fileUrl) {
    // Enviar via URL (mais eficiente, evita upload)
    formData.append('url', fileUrl);
    console.log(`🔍 [PDF-to-Text] Enviando URL para OCR.space...`);
  } else {
    // Enviar via base64 como file
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    formData.append('file', blob, 'document.pdf');
    console.log(`🔍 [PDF-to-Text] Enviando arquivo (${(pdfBytes.length / 1024).toFixed(1)} KB) para OCR.space...`);
  }

  const response = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`OCR.space API erro HTTP: ${response.status} ${response.statusText}`);
  }

  const result = await response.json();

  if (result.IsErroredOnProcessing) {
    const errorMsg = result.ErrorMessage?.join('; ') || result.ErrorDetails || 'Erro desconhecido no OCR';
    throw new Error(`OCR.space erro: ${errorMsg}`);
  }

  const parsedResults = result.ParsedResults || [];
  const pageTexts: string[] = [];
  let fullText = '';

  for (const parsed of parsedResults) {
    const pageText = (parsed.ParsedText || '').trim();
    pageTexts.push(pageText);
    fullText += (pageText ? pageText + '\n' : '');
  }

  fullText = fullText.trim();
  console.log(`🔍 [PDF-to-Text] OCR concluído: ${parsedResults.length} página(s), ${fullText.length} chars`);

  return { text: fullText, pages: parsedResults.length, pageTexts };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('📄 [PDF-to-Text] Iniciando processamento...');

    const body = await req.json();
    const { 
      file_base64, 
      file_url, 
      ocr_enabled = true,
      language = 'por',
      ocr_api_key,
      min_text_length = 50,
      ocr_engine = 2,
    } = body;

    if (!file_base64 && !file_url) {
      return new Response(
        JSON.stringify({ success: false, error: 'Envie file_base64 ou file_url' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Obter o buffer do PDF
    let pdfBytes: Uint8Array;
    let resolvedFileUrl: string | null = file_url || null;

    if (file_url) {
      console.log(`📄 [PDF-to-Text] Baixando PDF de URL: ${file_url.substring(0, 80)}...`);
      const response = await fetch(file_url);
      if (!response.ok) {
        throw new Error(`Erro ao baixar PDF: HTTP ${response.status} ${response.statusText}`);
      }
      pdfBytes = new Uint8Array(await response.arrayBuffer());
    } else {
      console.log('📄 [PDF-to-Text] Decodificando PDF de base64...');
      const binaryString = atob(file_base64);
      pdfBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        pdfBytes[i] = binaryString.charCodeAt(i);
      }
      resolvedFileUrl = null;
    }

    const fileSizeMB = (pdfBytes.length / 1024 / 1024).toFixed(2);
    console.log(`📄 [PDF-to-Text] Tamanho do PDF: ${pdfBytes.length} bytes (${fileSizeMB} MB)`);

    // 2. Tentar extração digital primeiro (rápido, sem custo)
    let digitalResult;
    try {
      digitalResult = await extractDigitalText(pdfBytes);
      console.log(`📄 [PDF-to-Text] Extração digital: ${digitalResult.text.length} chars, ${digitalResult.pages} páginas`);
    } catch (digitalError) {
      console.warn('⚠️ [PDF-to-Text] Extração digital falhou:', digitalError);
      digitalResult = { text: '', pages: 0, pageTexts: [] };
    }

    // 3. Se tem texto suficiente, retornar como digital
    if (digitalResult.text.length >= min_text_length) {
      console.log(`✅ [PDF-to-Text] PDF digital detectado. ${digitalResult.text.length} chars extraídos.`);
      return new Response(
        JSON.stringify({
          success: true,
          type: 'digital',
          text: digitalResult.text,
          pages: digitalResult.pages,
          chars: digitalResult.text.length,
          page_texts: digitalResult.pageTexts,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. PDF escaneado - tentar OCR
    if (!ocr_enabled) {
      return new Response(
        JSON.stringify({
          success: true,
          type: 'scanned',
          text: '',
          pages: digitalResult.pages || 1,
          chars: 0,
          ocr_attempted: false,
          note: 'PDF escaneado detectado. Habilite ocr_enabled=true para extrair texto via OCR.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter API key do OCR.space (env var ou body)
    const finalApiKey = ocr_api_key || Deno.env.get('OCR_SPACE_API_KEY') || '';

    if (!finalApiKey) {
      return new Response(
        JSON.stringify({
          success: false,
          type: 'scanned',
          text: '',
          pages: digitalResult.pages || 1,
          chars: 0,
          error: 'PDF escaneado detectado mas nenhuma chave OCR configurada. Configure OCR_SPACE_API_KEY nas env vars ou envie ocr_api_key no body. Obtenha grátis em https://ocr.space/ocrapi',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const ocrResult = await extractOcrText(pdfBytes, resolvedFileUrl, finalApiKey, language, ocr_engine);

      console.log(`✅ [PDF-to-Text] OCR concluído: ${ocrResult.text.length} chars`);

      return new Response(
        JSON.stringify({
          success: true,
          type: 'ocr',
          text: ocrResult.text,
          pages: ocrResult.pages,
          chars: ocrResult.text.length,
          page_texts: ocrResult.pageTexts,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (ocrError) {
      console.error('❌ [PDF-to-Text] OCR falhou:', ocrError);
      return new Response(
        JSON.stringify({
          success: false,
          type: 'scanned',
          text: '',
          pages: digitalResult.pages || 1,
          chars: 0,
          ocr_error: ocrError instanceof Error ? ocrError.message : String(ocrError),
          note: 'PDF escaneado. OCR falhou.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('❌ [PDF-to-Text] Erro fatal:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
