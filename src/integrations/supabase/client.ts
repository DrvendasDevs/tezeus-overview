import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/config';

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

/**
 * Cliente Supabase principal
 * Usa as credenciais hardcoded do config.ts
 */
export const supabase: SupabaseClient<Database> = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
    global: {
      headers: {
        'x-client-info': 'tezeus-crm',
      },
    },
  }
);

/**
 * Sincroniza o contexto do usuário atual no banco de dados
 * Deve ser chamado antes de operações que precisam de auditoria
 */
export async function syncUserContext(): Promise<void> {
  try {
    const savedUser = localStorage.getItem('currentUser');
    if (!savedUser) return;
    
    const user = JSON.parse(savedUser);
    if (!user?.id) return;

    await supabase.rpc('set_current_user_context', {
      user_id: user.id,
      user_email: user.email || null,
    });
  } catch (error) {
    // Silenciar erros para não bloquear operações
    console.warn('[Audit] Erro ao sincronizar contexto:', error);
  }
}

/**
 * Executa uma operação com contexto de usuário para auditoria
 * @param operation Função que executa a operação do Supabase
 * @returns Resultado da operação
 */
export async function withUserContext<T>(operation: () => Promise<T>): Promise<T> {
  await syncUserContext();
  return operation();
}
