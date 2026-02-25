// Script de teste para executar as correções
import { supabase } from './src/integrations/supabase/client.js';

async function executeCorrections() {
  console.log('🔧 Executando correções...');

  try {
    // 1. Corrigir números de telefone
    console.log('📱 Corrigindo números de telefone...');
    const { data: phoneResult, error: phoneError } = await supabase.functions.invoke('fix-phone-numbers-manual');
    
    if (phoneError) {
      console.error('❌ Erro ao corrigir números:', phoneError);
    } else {
      console.log('✅ Correção de números:', phoneResult);
    }

    // 2. Atualizar webhooks para v2
    console.log('🔗 Atualizando webhooks para v2...');
    const { data: webhookResult, error: webhookError } = await supabase.functions.invoke('update-all-webhooks-to-v2');
    
    if (webhookError) {
      console.error('❌ Erro ao atualizar webhooks:', webhookError);
    } else {
      console.log('✅ Atualização de webhooks:', webhookResult);
    }

  } catch (error) {
    console.error('❌ Erro geral:', error);
  }
}

executeCorrections();