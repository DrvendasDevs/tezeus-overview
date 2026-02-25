import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { useToast } from '@/hooks/use-toast';
import { PipelineColumn } from './usePipelines';

export function usePipelineColumns(pipelineId: string | null, workspaceId?: string) {
  const [columns, setColumns] = useState<PipelineColumn[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const { getHeaders } = useWorkspaceHeaders();
  const { toast } = useToast();
  const requestSeqRef = useRef(0);
  const errorToastTimeoutRef = useRef<number | null>(null);

  const fetchColumns = async () => {
    if (!pipelineId) {
      setColumns([]);
      setLastError(null);
      return;
    }

    try {
      const requestSeq = ++requestSeqRef.current;
      setIsLoading(true);
      setLastError(null);
      if (errorToastTimeoutRef.current) {
        window.clearTimeout(errorToastTimeoutRef.current);
        errorToastTimeoutRef.current = null;
      }
      const headers = getHeaders(workspaceId);

      // Retry com backoff para evitar toast em erro transitório ao trocar pipeline
      const maxAttempts = 3;
      let lastErr: any = null;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const { data, error } = await supabase.functions.invoke(
          `pipeline-management/columns?pipeline_id=${pipelineId}`,
          {
            method: 'GET',
            headers,
          }
        );

        if (!error) {
          // Ignore responses from older requests (pipelineId changed quickly)
          if (requestSeq !== requestSeqRef.current) return;

          setColumns(data || []);
          return;
        }

        lastErr = error;
        // backoff: 300ms, 800ms (antes da última tentativa)
        if (attempt < maxAttempts) {
          const delayMs = attempt === 1 ? 300 : 800;
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }

      throw lastErr;
    } catch (error: any) {
      console.error('Error fetching columns:', error);

      const msg =
        error?.message ||
        error?.context?.body?.message ||
        error?.context?.body?.error ||
        'Erro ao carregar colunas';

      setLastError(String(msg));

      // Toast só se o erro persistir (mesmo após retries)
      if (errorToastTimeoutRef.current) {
        window.clearTimeout(errorToastTimeoutRef.current);
      }
      errorToastTimeoutRef.current = window.setTimeout(() => {
        if (columns.length > 0) return;
        toast({
          title: "Erro",
          description: "Erro ao carregar colunas",
          variant: "destructive",
        });
      }, 2000);
    } finally {
      setIsLoading(false);
    }
  };

  const createColumn = async (name: string, color: string, icon: string = 'Circle') => {
    if (!pipelineId) return;

    try {
      const headers = getHeaders(workspaceId);
      
      const { data, error } = await supabase.functions.invoke('pipeline-management/columns', {
        method: 'POST',
        headers,
        body: { 
          pipeline_id: pipelineId,
          name,
          color,
          icon
        }
      });

      if (error) throw error;

      setColumns(prev => [...prev, data]);
      
      toast({
        title: "Sucesso",
        description: "Coluna criada com sucesso",
      });

      return data;
    } catch (error) {
      console.error('Error creating column:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar coluna",
        variant: "destructive",
      });
      throw error;
    }
  };

  useEffect(() => {
    // Only fetch if we have both pipelineId and can get headers
    const canFetch = () => {
      if (!pipelineId) return false;
      try {
        getHeaders(workspaceId);
        return true;
      } catch {
        return false;
      }
    };

    if (canFetch()) {
      fetchColumns();
    } else {
      setColumns([]);
      setLastError(null);
      setIsLoading(false);
    }
  }, [pipelineId, workspaceId]);

  return {
    columns,
    isLoading,
    fetchColumns,
    createColumn,
    lastError,
  };
}