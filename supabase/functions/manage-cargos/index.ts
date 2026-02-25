import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-system-user-id, x-system-user-email, x-workspace-id',
}

interface CargoData {
  nome: string;
  tipo: string;
  funcao?: string;
  permissions?: Record<string, any>;
  workspace_id?: string;
}

interface UpdateCargoData extends CargoData {
  id: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { action, cargoData } = await req.json()
    
    console.log('Manage cargos - Action:', action);
    console.log('Manage cargos - Data:', cargoData);

    switch (action) {
      case 'list': {
        const { data, error } = await supabase
          .from('cargos')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error listing cargos:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      case 'create': {
        const cargo: CargoData = cargoData;
        
        const { data, error } = await supabase
          .from('cargos')
          .insert([cargo])
          .select()
          .single();

        if (error) {
          console.error('Error creating cargo:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      case 'update': {
        const { id, ...updateData }: UpdateCargoData = cargoData;
        
        const { data, error } = await supabase
          .from('cargos')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('Error updating cargo:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      case 'delete': {
        const { id } = cargoData;
        
        // Soft delete - marcar como inativo
        const { data, error } = await supabase
          .from('cargos')
          .update({ is_active: false })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          console.error('Error deleting cargo:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid action' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }

  } catch (error) {
    console.error('Error in manage-cargos function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})