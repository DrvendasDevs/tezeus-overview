import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const PUBLIC_APP_URL = Deno.env.get('PUBLIC_APP_URL');
const EVO_DEFAULT_WEBHOOK_SECRET = Deno.env.get('EVO_DEFAULT_WEBHOOK_SECRET');

const corsHeaders = {
  'Access-Control-Allow-Origin': PUBLIC_APP_URL || '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function generateInstanceSlug(name: string, number: string): string {
  // Remove special characters and convert to lowercase
  const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const cleanNumber = number.replace(/[^0-9]/g, '');
  return `${cleanName}-${cleanNumber}`;
}

function generateWebhookSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    const { name, number } = await req.json();
    
    if (!name || !number) {
      return new Response(JSON.stringify({ error: 'Name and number are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate instance slug
    const instance = generateInstanceSlug(name, number);
    console.log(`Creating channel: ${name} (${number}) -> ${instance}`);

    // Check if channel already exists
    const { data: existingChannel } = await supabase
      .from('channels')
      .select('*')
      .eq('instance', instance)
      .single();

    if (existingChannel) {
      console.log(`Channel ${instance} already exists`);
      return new Response(JSON.stringify({ 
        id: existingChannel.id, 
        instance: existingChannel.instance 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate webhook secret
    const webhookSecret = generateWebhookSecret();

    // Create new channel
    const { data: newChannel, error: createError } = await supabase
      .from('channels')
      .insert({
        name,
        number,
        instance,
        status: 'disconnected',
        webhook_secret: webhookSecret,
      })
      .select()
      .single();

    if (createError) {
      console.error('Error creating channel:', createError);
      return new Response(JSON.stringify({ error: 'Failed to create channel' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Channel created successfully: ${newChannel.id}`);

    return new Response(JSON.stringify({ 
      id: newChannel.id, 
      instance: newChannel.instance 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in evo-channel function:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});