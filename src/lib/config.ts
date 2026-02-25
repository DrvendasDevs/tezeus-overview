/**
 * Configuração centralizada da aplicação
 * Valores do projeto Supabase conectado
 */

// Base 1 (2.1 tester)
export const SUPABASE_URL = "https://zdrgvdlfhrbynpkvtyhx.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpkcmd2ZGxmaHJieW5wa3Z0eWh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ3MDU2OTEsImV4cCI6MjA4MDI4MTY5MX0.MzCe3coYsKtl5knDRE2zrmTSomu58nMVVUokj5QMToM";
export const SUPABASE_PROJECT_ID = "zdrgvdlfhrbynpkvtyhx";

// Base 2 (2.0 com clientes) - Comentada
//  export const SUPABASE_URL = "https://zldeaozqxjwvzgrblyrh.supabase.co";
//  export const SUPABASE_ANON_KEY =
//  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpsZGVhb3pxeGp3dnpncmJseXJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNDQyNDYsImV4cCI6MjA2ODkyMDI0Nn0.4KmrswdBfTyHLqrUt9NdCBUjDPKCeO2NN7Vvqepr4xM";
//  export const SUPABASE_PROJECT_ID = "zldeaozqxjwvzgrblyrh";

export const DEFAULT_CONFIG = {
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  projectId: SUPABASE_PROJECT_ID,
};

/**
 * Constrói a URL completa de uma função Supabase Edge Function
 * @param functionName Nome da função (ex: 'evolution-webhook-v2')
 */
export function getSupabaseFunctionUrl(functionName: string): string {
  return `${SUPABASE_URL}/functions/v1/${functionName}`;
}

/**
 * Limpa cache de configuração (placeholder)
 */
export function clearConfigCache(): void {
  console.log("[config] Cache de configuração limpo");
}
