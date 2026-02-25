import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { useToast } from '@/hooks/use-toast';

export interface Pipeline {
  id: string;
  workspace_id: string;
  name: string;
  type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PipelineColumn {
  id: string;
  pipeline_id: string;
  name: string;
  color: string;
  icon?: string;
  order_position: number;
  permissions?: string[];
  view_all_deals_permissions?: string[];
  is_offer_stage?: boolean;
  created_at: string;
}

export interface PipelineCard {
  id: string;
  pipeline_id: string;
  column_id: string;
  conversation_id: string | null;
  contact_id: string | null;
  title: string;
  description: string | null;
  value: number;
  status: string;
  // Data/hora da última ação de status (ganho/perda/perdido/reaberto)
  status_action_at?: string | null;
  tags: any[];
  created_at: string;
  updated_at: string;
  responsible_user_id?: string;
  responsible_user?: {
    id: string;
    name: string;
    avatar?: string;
  };
  contact?: any;
  conversation?: any;
}

export function usePipelines(workspaceId?: string) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true
  const { getHeaders } = useWorkspaceHeaders();
  const { toast } = useToast();

  const fetchPipelines = async (retryCount = 0) => {
    const maxRetries = 3;
    const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 5000); // Exponential backoff, max 5s
    
    try {
      setIsLoading(true);
      
      // Refresh headers to ensure workspace context is current
      let headers;
      try {
        headers = getHeaders(workspaceId);
      } catch (headerError) {
        console.error('Error getting headers:', headerError);
        
        // If headers fail, it might be a session issue - check localStorage
        const userData = localStorage.getItem('currentUser');
        if (!userData) {
          throw new Error('Sessão expirada. Faça login novamente.');
        }
        throw headerError;
      }
      
      // Fetching pipelines
      
      const { data, error } = await supabase.functions.invoke('pipeline-management/pipelines', {
        method: 'GET',
        headers
      });

      if (error) {
        // Check if it's a specific error that should trigger retry
        if (error.message?.includes('Failed to fetch') || 
            error.message?.includes('workspace') ||
            error.message?.includes('headers') ||
            error.status >= 500) {
          throw new Error(`API_ERROR: ${error.message}`);
        }
        throw error;
      }

      setPipelines(data || []);
      
      // Auto-select first pipeline if none selected
      if (data?.length > 0 && !selectedPipeline) {
        setSelectedPipeline(data[0]);
      }
      
      // Pipelines loaded
      
    } catch (error) {
      console.error('Error fetching pipelines:', error);
      
      // Retry logic for specific errors
      if (retryCount < maxRetries && 
          (error.message?.includes('API_ERROR') || 
           error.message?.includes('Failed to fetch') ||
           error.message?.includes('workspace'))) {
        
        setTimeout(() => {
          fetchPipelines(retryCount + 1);
        }, retryDelay);
        
        return; // Don't show error toast on retry
      }
      
      // Show error only on final failure
      const errorMessage = error.message?.includes('Sessão expirada') 
        ? 'Sessão expirada. Atualize a página e faça login novamente.'
        : 'Erro ao carregar pipelines. Verifique sua conexão.';
        
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      if (retryCount === 0) { // Only set loading false on initial call
        setIsLoading(false);
      }
    }
  };

  const createPipeline = async (name: string, type: string) => {
    try {
      const headers = getHeaders(workspaceId);
      
      const { data, error } = await supabase.functions.invoke('pipeline-management/pipelines', {
        method: 'POST',
        headers,
        body: { name, type }
      });

      if (error) throw error;

      setPipelines(prev => [data, ...prev]);
      setSelectedPipeline(data);
      
      toast({
        title: "Sucesso",
        description: "Pipeline criado com sucesso",
      });

      return data;
    } catch (error) {
      console.error('Error creating pipeline:', error);
      toast({
        title: "Erro",
        description: "Erro ao criar pipeline",
        variant: "destructive",
      });
      throw error;
    }
  };

  const selectPipeline = (pipeline: Pipeline) => {
    setSelectedPipeline(pipeline);
  };

  useEffect(() => {
    // Only fetch if we have a workspace (either passed or from context)
    const canFetch = () => {
      try {
        getHeaders(workspaceId);
        return true;
      } catch {
        return false;
      }
    };

    if (canFetch()) {
      const timeoutId = setTimeout(() => {
        fetchPipelines();
      }, 100);
      
      return () => clearTimeout(timeoutId);
    } else {
      // No workspace available, don't fetch
      setIsLoading(false);
    }
  }, [workspaceId]); // Re-fetch when workspaceId changes

  return {
    pipelines,
    selectedPipeline,
    isLoading,
    fetchPipelines,
    createPipeline,
    selectPipeline,
  };
}