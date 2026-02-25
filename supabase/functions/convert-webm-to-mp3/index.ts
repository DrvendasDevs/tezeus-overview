// @ts-ignore - Edge functions usam módulos remotos no runtime Deno
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

let ffmpegModulePromise: Promise<any> | null = null;
let ffmpegInstance: any | null = null;

async function getFfmpegInstance() {
  if (!ffmpegModulePromise) {
    // @ts-ignore - Import remoto suportado pelo runtime Deno
    ffmpegModulePromise = import("https://esm.sh/@ffmpeg/ffmpeg@0.12.10?target=deno").then(
      (mod) => mod?.default ?? mod,
    );
  }

  const { createFFmpeg } = await ffmpegModulePromise;

  if (!ffmpegInstance) {
    ffmpegInstance = createFFmpeg({
      log: false,
      corePath: "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/ffmpeg-core.js",
    });
  }

  if (!ffmpegInstance.isLoaded()) {
    await ffmpegInstance.load();
  }

  return ffmpegInstance;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const payload = await req.json();
    const {
      mediaUrl,
      mimeType = "audio/webm",
      fileName = "audio",
      includeDataUrl = true,
      downloadHeaders = {},
    } = payload || {};

    if (!mediaUrl || typeof mediaUrl !== "string") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "O payload deve conter 'mediaUrl' (string) apontando para o arquivo WebM/OGG.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const response = await fetch(mediaUrl, {
      headers: downloadHeaders && typeof downloadHeaders === "object" ? downloadHeaders : undefined,
    });

    if (!response.ok) {
      throw new Error(`Falha ao baixar mediaUrl: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const sourceBytes = new Uint8Array(arrayBuffer);
    const sourceMime = response.headers.get("content-type") ?? mimeType;

    const ffmpeg = await getFfmpegInstance();
    const inputExtension = sourceMime.includes("ogg") ? "ogg" : sourceMime.includes("mp4") ? "m4a" : "webm";
    const inputFile = `input.${inputExtension}`;
    const outputFile = "output.mp3";

    ffmpeg.FS("writeFile", inputFile, sourceBytes);
    await ffmpeg.run("-y", "-i", inputFile, "-vn", "-ar", "44100", "-ac", "2", "-b:a", "128k", outputFile);
    const convertedData = ffmpeg.FS("readFile", outputFile);

    try {
      ffmpeg.FS("unlink", inputFile);
      ffmpeg.FS("unlink", outputFile);
    } catch (_error) {
      // Ignorar erros de limpeza
    }

    const mp3Base64 = uint8ArrayToBase64(convertedData);
    const finalFileName = fileName.endsWith(".mp3") ? fileName : `${fileName}.mp3`;

    return new Response(
      JSON.stringify({
        success: true,
        fileName: finalFileName,
        contentType: "audio/mpeg",
        byteLength: convertedData.length,
        base64: mp3Base64,
        dataUrl: includeDataUrl ? `data:audio/mpeg;base64,${mp3Base64}` : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("convert-webm-to-mp3 error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro interno ao converter áudio.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

