import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface InstanceAssignment {
  id: string;
  instance: string;
  user_id: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export function useInstanceAssignments(userId?: string) {
  const [assignments, setAssignments] = useState<InstanceAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setAssignments([]);
      setIsLoading(false);
      return;
    }

    async function fetchAssignments() {
      try {
        setIsLoading(true);
        setError(null);

        const { data, error } = await supabase
          .from('instance_user_assignments')
          .select('*')
          .eq('user_id', userId)
          .order('instance');

        if (error) throw error;
        setAssignments(data || []);
      } catch (err) {
        console.error('Error fetching instance assignments:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar atribuições');
      } finally {
        setIsLoading(false);
      }
    }

    fetchAssignments();
  }, [userId]);

  const saveAssignments = async (instanceIds: string[], defaultInstance?: string) => {
    if (!userId) return;

    try {
      // Delete existing assignments for this user
      await supabase
        .from('instance_user_assignments')
        .delete()
        .eq('user_id', userId);

      if (instanceIds.length > 0) {
        // Insert new assignments
        const newAssignments = instanceIds.map(instance => ({
          instance,
          user_id: userId,
          is_default: instance === defaultInstance
        }));

        const { error } = await supabase
          .from('instance_user_assignments')
          .insert(newAssignments);

        if (error) throw error;
      }

      // Refresh assignments
      const { data, error: fetchError } = await supabase
        .from('instance_user_assignments')
        .select('*')
        .eq('user_id', userId)
        .order('instance');

      if (fetchError) throw fetchError;
      setAssignments(data || []);
      
      return true;
    } catch (err) {
      console.error('Error saving instance assignments:', err);
      setError(err instanceof Error ? err.message : 'Erro ao salvar atribuições');
      return false;
    }
  };

  return { 
    assignments, 
    isLoading, 
    error, 
    saveAssignments 
  };
}