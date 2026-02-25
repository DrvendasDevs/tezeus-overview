import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { useToast } from '@/hooks/use-toast';

export function usePipelineCardAutoCreation() {
  const [isCreating, setIsCreating] = useState(false);
  const { getHeaders } = useWorkspaceHeaders();
  const { toast } = useToast();

  const checkAndCreateCard = useCallback(async (
    conversationId: string,
    contactId: string,
    workspaceId: string,
    pipelineId?: string
  ) => {
    try {
      setIsCreating(true);

      // Usar a Edge Function inteligente que gerencia unicidade
      const { data, error } = await supabase.functions.invoke('smart-pipeline-card-manager', {
        body: {
          contactId,
          conversationId,
          workspaceId,
          pipelineId
        }
      });

      console.log('📊 Resposta da Edge Function:', { data, error });

      if (error) {
        console.error('❌ Erro na Edge Function:', error);
        console.log('📦 Data recebido com erro:', data);
        
        // Tentar extrair mensagem do body quando status é 409
        if (data) {
          if (data.error === 'duplicate_open_card') {
            toast({
              title: 'Negócio já existe',
              description: data.message || 'Já existe um negócio aberto para este contato neste pipeline. Finalize o anterior antes de criar um novo.',
              variant: 'destructive',
            });
            return null;
          }
          
          // Outro tipo de erro mas com mensagem no data
          if (data.message) {
            toast({
              title: 'Erro ao criar negócio',
              description: data.message,
              variant: 'destructive',
            });
            return null;
          }
        }
        
        // Erro genérico
        toast({
          title: 'Erro ao criar negócio',
          description: error.message || 'Ocorreu um erro ao tentar criar o negócio',
          variant: 'destructive',
        });
        return null;
      }

      // Verificar se retornou erro de card duplicado no data (caso retorne 200 com erro)
      if (data?.error === 'duplicate_open_card') {
        console.log('⚠️ Negócio aberto já existe para este contato');
        toast({
          title: 'Negócio já existe',
          description: data.message || 'Já existe um negócio aberto para este contato neste pipeline. Finalize o anterior antes de criar um novo.',
          variant: 'destructive',
        });
        return null;
      }

      // Mostrar toast apenas se foi criado um novo card
      if (data?.action === 'created') {
        console.log('✅ Card criado:', data.card);
        toast({
          title: 'CRM atualizado',
          description: 'Novo negócio criado automaticamente',
        });
      } else if (data?.action === 'updated') {
        console.log('✅ Card atualizado:', data.card);
        // Não mostrar toast para atualizações silenciosas
      }

      return data?.card || null;

    } catch (error) {
      console.error('💥 Erro ao gerenciar card:', error);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [toast]);

  return {
    checkAndCreateCard,
    isCreating
  };
}