import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useProfileImages = () => {
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const { toast } = useToast();

  const fetchProfileImage = async (phone: string, contactId?: string) => {
    if (loading[phone]) return;

    setLoading(prev => ({ ...prev, [phone]: true }));

    try {
      console.log('Attempting to fetch profile image for:', phone);
      
      // Try to get contact data first to see if there's already a profile image
      const { data: contact } = await supabase
        .from('contacts')
        .select('profile_image_url, profile_image_updated_at')
        .eq(contactId ? 'id' : 'phone', contactId || phone)
        .single();

      if (contact?.profile_image_url) {
        // Check if image was updated recently (less than 7 days ago)
        const lastUpdate = contact.profile_image_updated_at ? new Date(contact.profile_image_updated_at) : null;
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        if (lastUpdate && lastUpdate > sevenDaysAgo) {
          console.log('Profile image is recent, skipping fetch');
          return contact.profile_image_url;
        }
      }

      // For manual requests, show message that automatic fetch happens via webhooks
      toast({
        title: "Busca de Imagem de Perfil",
        description: "As imagens de perfil são atualizadas automaticamente quando novas mensagens chegam",
        variant: "default"
      });
      
      return contact?.profile_image_url || null;
    } catch (error) {
      console.error('Error fetching profile image:', error);
      toast({
        title: "Erro",
        description: "Erro ao buscar imagem de perfil",
        variant: "destructive"
      });
      return null;
    } finally {
      setLoading(prev => ({ ...prev, [phone]: false }));
    }
  };

  const isLoading = (phone: string) => loading[phone] || false;

  return {
    fetchProfileImage,
    isLoading
  };
};