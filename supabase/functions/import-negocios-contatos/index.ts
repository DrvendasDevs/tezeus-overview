import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-workspace-id, x-system-user-id, x-system-user-email',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ImportRow {
  nome: string;
  telefone: string;
  email?: string;
  nomeNegocio: string;
  valor: number;
  pipeline: string;
  fase: string;
  tags?: string;
  responsavel?: string;
  linha: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { workspace_id, rows } = await req.json();

    if (!workspace_id || !rows || !Array.isArray(rows)) {
      return new Response(
        JSON.stringify({ error: 'workspace_id e rows são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📥 [import-negocios-contatos] Iniciando importação para workspace ${workspace_id}, ${rows.length} linhas`);

    const result = {
      total: rows.length,
      sucessos: 0,
      erros: 0,
      duplicados: 0,
      contatos_criados: 0,
      contatos_reutilizados: 0,
      negocios_criados: 0,
      erros_detalhados: [] as Array<{ linha: number; erro: string }>,
    };

    // Cache para pipelines, colunas, tags e usuários
    const pipelineCache = new Map<string, string>(); // nome -> id
    const columnCache = new Map<string, { pipelineId: string; columnId: string }>(); // "pipeline:fase" -> { pipelineId, columnId }
    const tagCache = new Map<string, string>(); // nome -> id
    const userCache = new Map<string, string | null>(); // nome -> id ou null

    // Função para buscar pipeline por nome
    const getPipelineId = async (pipelineName: string): Promise<string | null> => {
      if (pipelineCache.has(pipelineName)) {
        return pipelineCache.get(pipelineName)!;
      }

      const { data, error } = await supabase
        .from('pipelines')
        .select('id')
        .eq('workspace_id', workspace_id)
        .eq('name', pipelineName.trim())
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return null;
      }

      pipelineCache.set(pipelineName, data.id);
      return data.id;
    };

    // Função para buscar coluna por pipeline e nome
    const getColumnId = async (pipelineId: string, faseName: string): Promise<string | null> => {
      const cacheKey = `${pipelineId}:${faseName}`;
      if (columnCache.has(cacheKey)) {
        return columnCache.get(cacheKey)!.columnId;
      }

      const { data, error } = await supabase
        .from('pipeline_columns')
        .select('id')
        .eq('pipeline_id', pipelineId)
        .eq('name', faseName.trim())
        .single();

      if (error || !data) {
        return null;
      }

      columnCache.set(cacheKey, { pipelineId, columnId: data.id });
      return data.id;
    };

    // Função para buscar ou criar tag
    const getOrCreateTag = async (tagName: string): Promise<string | null> => {
      const normalizedName = tagName.trim();
      if (!normalizedName) return null;

      if (tagCache.has(normalizedName)) {
        return tagCache.get(normalizedName)!;
      }

      // Buscar tag existente
      const { data: existingTag } = await supabase
        .from('tags')
        .select('id')
        .eq('name', normalizedName)
        .single();

      if (existingTag) {
        tagCache.set(normalizedName, existingTag.id);
        return existingTag.id;
      }

      // Criar nova tag
      const colors = ['#808080', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const { data: newTag, error } = await supabase
        .from('tags')
        .insert({
          name: normalizedName,
          color: randomColor,
        })
        .select('id')
        .single();

      if (error || !newTag) {
        console.error(`Erro ao criar tag ${normalizedName}:`, error);
        return null;
      }

      tagCache.set(normalizedName, newTag.id);
      return newTag.id;
    };

    // Função para buscar usuário por nome
    const getUserIdByName = async (userName: string): Promise<string | null> => {
      const normalizedName = userName.trim();
      if (!normalizedName) return null;

      if (userCache.has(normalizedName)) {
        return userCache.get(normalizedName) || null;
      }

      // Buscar em system_users
      const { data: user } = await supabase
        .from('system_users')
        .select('id')
        .ilike('name', normalizedName)
        .limit(1)
        .single();

      const userId = user?.id || null;
      userCache.set(normalizedName, userId);
      return userId;
    };

    // Processar cada linha
    for (const row of rows as ImportRow[]) {
      try {
        // Validar dados obrigatórios
        if (!row.nome || !row.telefone || !row.nomeNegocio || !row.pipeline || !row.fase) {
          result.erros++;
          result.erros_detalhados.push({
            linha: row.linha,
            erro: 'Dados obrigatórios faltando (nome, telefone, nome do negócio, pipeline ou fase)',
          });
          continue;
        }

        // Buscar pipeline
        const pipelineId = await getPipelineId(row.pipeline);
        if (!pipelineId) {
          result.erros++;
          result.erros_detalhados.push({
            linha: row.linha,
            erro: `Pipeline "${row.pipeline}" não encontrada no workspace`,
          });
          continue;
        }

        // Buscar coluna/fase
        const columnId = await getColumnId(pipelineId, row.fase);
        if (!columnId) {
          result.erros++;
          result.erros_detalhados.push({
            linha: row.linha,
            erro: `Fase "${row.fase}" não encontrada na pipeline "${row.pipeline}"`,
          });
          continue;
        }

        // Normalizar telefone (remover caracteres não numéricos)
        const normalizedPhone = row.telefone.replace(/\D/g, '');

        // Buscar ou criar contato
        let contactId: string;
        let isNewContact = false;

        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('workspace_id', workspace_id)
          .eq('phone', normalizedPhone)
          .single();

        if (existingContact) {
          contactId = existingContact.id;
          result.contatos_reutilizados++;
          result.duplicados++;
        } else {
          // Criar novo contato
          const { data: newContact, error: contactError } = await supabase
            .from('contacts')
            .insert({
              name: row.nome,
              phone: normalizedPhone,
              email: row.email || null,
              workspace_id: workspace_id,
            })
            .select('id')
            .single();

          if (contactError || !newContact) {
            result.erros++;
            result.erros_detalhados.push({
              linha: row.linha,
              erro: `Erro ao criar contato: ${contactError?.message || 'Erro desconhecido'}`,
            });
            continue;
          }

          contactId = newContact.id;
          isNewContact = true;
          result.contatos_criados++;
        }

        // Processar tags
        const tagIds: string[] = [];
        if (row.tags) {
          const tagNames = row.tags.split(/[,;]/).map((t) => t.trim()).filter((t) => t);
          for (const tagName of tagNames) {
            const tagId = await getOrCreateTag(tagName);
            if (tagId) {
              tagIds.push(tagId);
            }
          }

          // Vincular tags ao contato (se for novo contato ou se não tiver tags)
          if (tagIds.length > 0) {
            // Verificar tags existentes do contato
            const { data: existingContactTags } = await supabase
              .from('contact_tags')
              .select('tag_id')
              .eq('contact_id', contactId);

            const existingTagIds = new Set(existingContactTags?.map((ct) => ct.tag_id) || []);
            
            // Adicionar apenas tags que não existem
            const newContactTags = tagIds
              .filter((tagId) => !existingTagIds.has(tagId))
              .map((tagId) => ({
                contact_id: contactId,
                tag_id: tagId,
              }));

            if (newContactTags.length > 0) {
              await supabase.from('contact_tags').insert(newContactTags);
            }
          }
        }

        // Buscar responsável
        let responsibleUserId: string | null = null;
        if (row.responsavel) {
          responsibleUserId = await getUserIdByName(row.responsavel);
        }

        // Criar card/negócio
        const cardTitle = row.nomeNegocio || row.nome;
        const { data: newCard, error: cardError } = await supabase
          .from('pipeline_cards')
          .insert({
            pipeline_id: pipelineId,
            column_id: columnId,
            contact_id: contactId,
            title: cardTitle,
            description: `Importado em ${new Date().toLocaleString('pt-BR')}`,
            value: row.valor || 0,
            status: 'aberto',
            tags: tagIds.length > 0 ? tagIds : [],
            responsible_user_id: responsibleUserId,
          })
          .select('id')
          .single();

        if (cardError || !newCard) {
          result.erros++;
          result.erros_detalhados.push({
            linha: row.linha,
            erro: `Erro ao criar negócio: ${cardError?.message || 'Erro desconhecido'}`,
          });
          continue;
        }

        result.negocios_criados++;
        result.sucessos++;
      } catch (error: any) {
        result.erros++;
        result.erros_detalhados.push({
          linha: row.linha,
          erro: error?.message || 'Erro desconhecido ao processar linha',
        });
        console.error(`Erro ao processar linha ${row.linha}:`, error);
      }
    }

    console.log(`✅ [import-negocios-contatos] Importação concluída:`, result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('❌ [import-negocios-contatos] Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro ao processar importação' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

