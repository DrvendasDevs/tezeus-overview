import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔧 Corrigindo números de telefone problemáticos...');
    
    // Buscar contatos com números problemáticos
    const { data: problematicContacts, error: selectError } = await supabase
      .from('contacts')
      .select('id, name, phone, workspace_id')
      .or('phone.like.%@lid,phone.like.%@s.whatsapp.net,phone.like.%@g.us,phone.like.%@broadcast,phone.like.%@c.us');

    if (selectError) {
      throw new Error(`Erro ao buscar contatos: ${selectError.message}`);
    }

    console.log(`📊 Encontrados ${problematicContacts?.length || 0} contatos com números problemáticos`);

    const results = [];
    let updatedCount = 0;

    for (const contact of problematicContacts || []) {
      const oldPhone = contact.phone;
      // Limpar número removendo sufixos e caracteres não numéricos
      let newPhone = oldPhone;
      
      // Remover sufixos específicos
      newPhone = newPhone.replace(/@lid$/, '');
      newPhone = newPhone.replace(/@s\.whatsapp\.net$/, '');
      newPhone = newPhone.replace(/@g\.us$/, '');
      newPhone = newPhone.replace(/@broadcast$/, '');
      newPhone = newPhone.replace(/@c\.us$/, '');
      
      // Remover todos os caracteres não numéricos
      newPhone = newPhone.replace(/[^0-9]/g, '');

      if (newPhone !== oldPhone && newPhone.length > 0) {
        // Verificar se já existe um contato com o número correto no mesmo workspace
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('phone', newPhone)
          .eq('workspace_id', contact.workspace_id)
          .neq('id', contact.id)
          .single();

        if (existingContact) {
          console.log(`⚠️ Contato ${contact.name} tem número duplicado, precisa de merge manual`);
          results.push({
            contact_id: contact.id,
            name: contact.name,
            old_phone: oldPhone,
            new_phone: newPhone,
            action: 'duplicate_found_needs_manual_merge'
          });
        } else {
          // Atualizar o número
          const { error: updateError } = await supabase
            .from('contacts')
            .update({ 
              phone: newPhone,
              updated_at: new Date().toISOString()
            })
            .eq('id', contact.id);

          if (updateError) {
            console.error(`❌ Erro ao atualizar contato ${contact.id}:`, updateError.message);
            results.push({
              contact_id: contact.id,
              name: contact.name,
              old_phone: oldPhone,
              new_phone: newPhone,
              action: 'error',
              error: updateError.message
            });
          } else {
            console.log(`✅ Contato ${contact.name}: ${oldPhone} → ${newPhone}`);
            updatedCount++;
            results.push({
              contact_id: contact.id,
              name: contact.name,
              old_phone: oldPhone,
              new_phone: newPhone,
              action: 'updated'
            });
          }
        }
      }
    }

    console.log(`🎉 Correção concluída: ${updatedCount} contatos atualizados`);

    return new Response(JSON.stringify({
      success: true,
      message: `Corrigidos ${updatedCount} números de telefone`,
      updated_count: updatedCount,
      results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro na correção:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});