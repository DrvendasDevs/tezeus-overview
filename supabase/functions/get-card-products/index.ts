import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { cardId } = await req.json();

    if (!cardId) {
      return new Response(
        JSON.stringify({ success: false, error: "cardId obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[get-card-products] Buscando produtos para card: ${cardId}`);

    // Buscar todos os produtos vinculados ao card (mesmo formato que DealDetailsPage)
    const { data: cardProducts, error } = await supabase
      .from("pipeline_cards_products")
      .select(`
        *,
        product:products(id, name, value)
      `)
      .eq("pipeline_card_id", cardId);

    if (error) {
      console.error("[get-card-products] Erro ao buscar produtos:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[get-card-products] Produtos encontrados: ${cardProducts?.length || 0}`);
    console.log(`[get-card-products] Dados brutos:`, JSON.stringify(cardProducts, null, 2));

    // Se a relação com products não trouxe os valores, buscar diretamente
    const productIds = (cardProducts || [])
      .map((cp: any) => cp.product_id)
      .filter((id: string | null) => id != null);
    
    let productsMap: Record<string, { name: string; value: number }> = {};
    
    if (productIds.length > 0) {
      const { data: productsData, error: productsError } = await supabase
        .from("products")
        .select("id, name, value")
        .in("id", productIds);
      
      console.log(`[get-card-products] Produtos buscados diretamente:`, productsData);
      
      if (!productsError && productsData) {
        productsMap = productsData.reduce((acc: Record<string, any>, p: any) => {
          acc[p.id] = { name: p.name, value: p.value };
          return acc;
        }, {});
      }
    }

    // Calcular valor total e extrair informações
    let totalValue = 0;
    const products = (cardProducts || []).map((cp: any) => {
      const directProduct = productsMap[cp.product_id];
      const quantity = cp.quantity || 1;
      
      console.log(`[get-card-products] Processando produto:`, {
        id: cp.id,
        product_id: cp.product_id,
        quantity: quantity,
        total_value: cp.total_value,
        unit_value: cp.unit_value,
        product_value: cp.product?.value,
        direct_product_value: directProduct?.value,
        product_name: cp.product?.name,
        direct_product_name: directProduct?.name,
        product_name_snapshot: cp.product_name_snapshot
      });
      
      // Calcular valor: prioridade total_value, senão unit_value * quantity, senão product.value * quantity
      let value = 0;
      if (cp.total_value && cp.total_value > 0) {
        // Se tem total_value salvo, usar diretamente
        value = Number(cp.total_value);
      } else if (cp.unit_value && cp.unit_value > 0) {
        // Se tem unit_value, multiplicar pela quantidade
        value = Number(cp.unit_value) * quantity;
      } else if (cp.product?.value && cp.product.value > 0) {
        // Se tem valor do produto via join, multiplicar pela quantidade
        value = Number(cp.product.value) * quantity;
      } else if (directProduct?.value && directProduct.value > 0) {
        // Se tem valor do produto via lookup direto, multiplicar pela quantidade
        value = Number(directProduct.value) * quantity;
      }
      
      const name = cp.product?.name || directProduct?.name || cp.product_name_snapshot || null;
      
      console.log(`[get-card-products] Valor calculado para produto ${cp.product_id}: ${value} (qty: ${quantity}), Nome: ${name}`);
      
      totalValue += value;
      return {
        id: cp.id,
        product_id: cp.product_id,
        name: name,
        value: value,
        quantity: quantity
      };
    });

    console.log(`[get-card-products] Valor total calculado: ${totalValue}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        products,
        totalValue,
        count: products.length
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[get-card-products] Exception:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
