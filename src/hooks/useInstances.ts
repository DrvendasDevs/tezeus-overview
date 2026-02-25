import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Instance {
  instance: string;
  displayName?: string;
}

export function useInstances() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInstances() {
      try {
        setIsLoading(true);
        setError(null);

        // Get instances from connections table
        const { data: connectionsData, error: connectionsError } = await supabase
          .from('connections')
          .select('instance_name, phone_number')
          .order('instance_name');

        if (connectionsError) {
          console.warn('Error fetching from connections:', connectionsError);
        }

        // Get from instance_user_assignments (current instances in use)
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from('instance_user_assignments')
          .select('instance')
          .order('instance');

        if (assignmentsError) {
          console.warn('Error fetching from assignments:', assignmentsError);
        }

        // Combine and deduplicate instances
        const allInstances = new Set<string>();
        
        if (connectionsData) {
          connectionsData.forEach(connection => {
            if (connection.instance_name) {
              allInstances.add(connection.instance_name);
            }
          });
        }

        if (assignmentsData) {
          assignmentsData.forEach(assignment => {
            if (assignment.instance) {
              allInstances.add(assignment.instance);
            }
          });
        }

        // Convert to array with display names
        const instanceList: Instance[] = Array.from(allInstances).map(instance => {
          const connection = connectionsData?.find(c => c.instance_name === instance);
          const displayName = connection?.phone_number 
            ? `${instance} (${connection.phone_number})`
            : instance;
          
          return {
            instance,
            displayName
          };
        });

        setInstances(instanceList);
      } catch (err) {
        console.error('Error fetching instances:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar instâncias');
      } finally {
        setIsLoading(false);
      }
    }

    fetchInstances();
  }, []);

  return { instances, isLoading, error };
}