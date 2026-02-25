import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { useToast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export interface ContactPipelineCard {
  id: string;
  pipeline_id: string;
  pipeline_name: string;
  column_id: string;
  column_name: string;
  status: string;
  value?: number;
  description?: string;
}

export function useContactPipelineCards(contactId: string | null) {
  const [cards, setCards] = useState<ContactPipelineCard[]>([]);
  const [currentPipeline, setCurrentPipeline] = useState<{ id: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { getHeaders } = useWorkspaceHeaders();
  const { toast } = useToast();
  const { selectedWorkspace } = useWorkspace();

  const fetchContactCards = async () => {
    if (!contactId || !selectedWorkspace) {
      setCards([]);
      setCurrentPipeline(null);
      return;
    }

    try {
      setIsLoading(true);
      const headers = getHeaders();
      
      // Tentativa 1: Query com joins (ideal)

      const { data: joinData, error: joinError } = await supabase
        .from('pipeline_cards')
        .select(`
          id,
          pipeline_id,
          column_id,
          status,
          value,
          description,
          pipelines!inner(id, name, workspace_id),
          pipeline_columns!inner(id, name)
        `)
        .eq('contact_id', contactId)
        .eq('pipelines.workspace_id', selectedWorkspace.workspace_id);

      let cardsData = joinData;

      // Se o join retornou dados nulos (problema de RLS), usar fallback
      if (!joinError && joinData?.some(card => !card.pipelines || !card.pipeline_columns)) {
        console.warn('[useContactPipelineCards] Join retornou dados nulos, usando fallback...');
        
        const { data: cardsOnly, error: cardsOnlyError } = await supabase
          .from('pipeline_cards')
          .select('id, pipeline_id, column_id, status, value, description')
          .eq('contact_id', contactId);
        
        if (cardsOnlyError) throw cardsOnlyError;
        
        if (cardsOnly && cardsOnly.length > 0) {
          const pipelineIds = [...new Set(cardsOnly.map(c => c.pipeline_id))];
          const columnIds = [...new Set(cardsOnly.map(c => c.column_id))];
          
          const { data: pipelines } = await supabase
            .from('pipelines')
            .select('id, name, workspace_id')
            .in('id', pipelineIds)
            .eq('workspace_id', selectedWorkspace.workspace_id);
          
          const { data: columns } = await supabase
            .from('pipeline_columns')
            .select('id, name')
            .in('id', columnIds);
          
          cardsData = cardsOnly.map(card => ({
            ...card,
            pipelines: pipelines?.find(p => p.id === card.pipeline_id) || null,
            pipeline_columns: columns?.find(c => c.id === card.column_id) || null
          }));
        }
      }

      if (joinError) {
        console.error('[useContactPipelineCards] Erro na query:', joinError);
        throw joinError;
      }

      const workspaceCards = cardsData?.filter(card => 
        (card.pipelines as any)?.workspace_id === selectedWorkspace.workspace_id
      ) || [];

      const formattedCards = workspaceCards.map(card => ({
        id: card.id,
        pipeline_id: card.pipeline_id,
        pipeline_name: (card.pipelines as any)?.name || 'Pipeline não encontrado',
        column_id: card.column_id,
        column_name: (card.pipeline_columns as any)?.name || 'Coluna não encontrada',
        status: card.status,
        value: card.value,
        description: card.description,
      }));

      setCards(formattedCards);
      
      // Definir pipeline atual (primeiro card ativo encontrado)
      if (formattedCards.length > 0) {
        const firstCard = formattedCards[0];
        setCurrentPipeline({
          id: firstCard.pipeline_id,
          name: firstCard.pipeline_name
        });
      } else {
        setCurrentPipeline(null);
      }

    } catch (error) {
      console.error('Error fetching contact cards:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const transferToPipeline = async (pipelineId: string, pipelineName: string) => {
    if (!contactId) return;

    try {
      const headers = getHeaders();
      
      // Verificar se já existe card nesse pipeline
      const existingCard = cards.find(card => card.pipeline_id === pipelineId);
      
      if (existingCard) {
        // Se já existe, apenas notificar
        toast({
          title: "Informação",
          description: `Contato já possui negócio no pipeline "${pipelineName}"`,
        });
        return;
      }

      // Buscar primeira coluna do pipeline
      const { data: columns, error: columnsError } = await supabase
        .from('pipeline_columns')
        .select('id')
        .eq('pipeline_id', pipelineId)
        .order('order_position')
        .limit(1);

      if (columnsError) throw columnsError;
      
      if (!columns || columns.length === 0) {
        toast({
          title: "Erro",
          description: "Pipeline não possui colunas configuradas",
          variant: "destructive",
        });
        return;
      }

      // Criar novo card no pipeline
      const { data, error } = await supabase.functions.invoke('pipeline-management/cards', {
        method: 'POST',
        headers,
        body: { 
          pipeline_id: pipelineId,
          column_id: columns[0].id,
          contact_id: contactId,
          title: `Negócio - Contato`,
          description: 'Negócio criado automaticamente',
          status: 'aberto'
        }
      });

      if (error) throw error;

      // Atualizar estado local
      await fetchContactCards();
      
      toast({
        title: "Sucesso",
        description: `Contato transferido para o pipeline "${pipelineName}"`,
      });

    } catch (error) {
      console.error('Error transferring to pipeline:', error);
      toast({
        title: "Erro",
        description: "Erro ao transferir contato para pipeline",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchContactCards();
  }, [contactId, selectedWorkspace]);

  return {
    cards,
    currentPipeline,
    isLoading,
    fetchContactCards,
    transferToPipeline,
  };
}
