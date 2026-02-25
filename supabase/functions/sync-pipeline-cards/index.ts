import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔧 Sync Pipeline Cards Function Started');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar todos os cards que têm conversa mas não têm responsible_user_id
    const { data: cardsToSync, error: fetchError } = await supabase
      .from('pipeline_cards')
      .select(`
        id,
        conversation_id,
        responsible_user_id,
        conversations!inner (
          assigned_user_id
        )
      `)
      .not('conversation_id', 'is', null)
      .is('responsible_user_id', null)
      .not('conversations.assigned_user_id', 'is', null);

    if (fetchError) {
      console.error('❌ Error fetching cards to sync:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch cards' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`📋 Found ${cardsToSync?.length || 0} cards to sync`);

    if (!cardsToSync || cardsToSync.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'No cards need synchronization',
          synced_count: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar cada card com o responsible_user_id da conversa
    const updates = cardsToSync.map(card => ({
      id: card.id,
      responsible_user_id: (card.conversations as any).assigned_user_id
    }));

    let syncedCount = 0;
    const errors = [];

    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('pipeline_cards')
        .update({ responsible_user_id: update.responsible_user_id })
        .eq('id', update.id);

      if (updateError) {
        console.error(`❌ Error updating card ${update.id}:`, updateError);
        errors.push({ card_id: update.id, error: updateError.message });
      } else {
        syncedCount++;
        console.log(`✅ Synced card ${update.id} with user ${update.responsible_user_id}`);
      }
    }

    console.log(`🎉 Synchronization complete: ${syncedCount} cards synced`);

    return new Response(
      JSON.stringify({
        message: 'Synchronization complete',
        synced_count: syncedCount,
        total_found: cardsToSync.length,
        errors: errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});