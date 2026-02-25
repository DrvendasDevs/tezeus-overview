import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Channel {
  id: string;
  name: string;
  number: string;
  instance: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export const useChannels = () => {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchChannels = async () => {
    setLoading(true);
    try {
      // Since channels table doesn't exist, we'll use connections instead
      const { data, error } = await supabase
        .from('connections')
        .select('id, instance_name, phone_number, status, created_at, updated_at')
        .eq('status', 'connected')
        .order('instance_name');

      if (error) {
        console.error('Error fetching connections:', error);
        toast({
          title: "Erro ao carregar canais",
          description: "Não foi possível carregar a lista de canais",
          variant: "destructive"
        });
        return;
      }

      // Map connections to channels format
      const mappedChannels = (data || []).map(connection => ({
        id: connection.id,
        name: connection.instance_name,
        number: connection.phone_number || '',
        instance: connection.instance_name,
        status: connection.status,
        created_at: connection.created_at,
        updated_at: connection.updated_at
      }));

      setChannels(mappedChannels);
    } catch (error) {
      console.error('Error fetching connections:', error);
      toast({
        title: "Erro ao carregar canais",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  return {
    channels,
    loading,
    refetch: fetchChannels
  };
};