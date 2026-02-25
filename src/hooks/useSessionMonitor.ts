import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export const useSessionMonitor = () => {
  const { user, logout } = useAuth();
  const channelRef = useRef<any>(null);
  const hasNotifiedRef = useRef(false);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isDisabledRef = useRef(false); // Desabilitar se tabela não existir

  useEffect(() => {
    // TEMPORARIAMENTE DESABILITADO - tabela user_sessions não existe ainda
    // Remover esta linha quando a migration for criada
    return;

    if (!user?.id) {
      // Limpar canal se não houver usuário
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      hasNotifiedRef.current = false;
      return;
    }

    const sessionToken = localStorage.getItem('sessionToken');
    if (!sessionToken) {
      // Se não há sessionToken, não monitorar (usuário ainda não completou login)
      return;
    }

    // Função para lidar com sessão invalidada
    const handleSessionInvalidated = async () => {
      if (hasNotifiedRef.current) {
        return; // Evitar múltiplas notificações
      }

      hasNotifiedRef.current = true;
      
      // Limpar localStorage IMEDIATAMENTE para garantir logout
      localStorage.removeItem('currentUser');
      localStorage.removeItem('selectedWorkspace');
      localStorage.removeItem('sessionToken');
      
      // Limpar interval e channel
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      
      // Fazer logout do Supabase Auth silenciosamente
      try {
        await supabase.auth.signOut();
      } catch (e) {
        // Erro ignorado silenciosamente
      }
      
      // Mostrar notificação
      toast.error('Sessão encerrada', {
        description: 'Outro acesso foi realizado com suas credenciais. Por segurança, sua sessão foi encerrada.',
        duration: 5000,
      });

      // Redirecionar para login após pequeno delay para mostrar o toast
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
    };

    // Verificar se a sessão existe e está ativa antes de começar a monitorar
    const verifyAndStartMonitoring = async () => {
      try {
        const { data, error } = await (supabase
          .from('user_sessions' as any)
          .select('is_active')
          .eq('session_token', sessionToken)
          .eq('user_id', user.id)
          .single() as any) as { data: { is_active: boolean } | null; error: any };

        // Se a sessão não existe ou não está ativa, não iniciar monitoramento
        // (pode ser que o login ainda não foi completado)
        if (error) {
          // Se erro 406 (not found), tentar novamente depois
          if (error.code === 'PGRST116' || error.message?.includes('No rows')) {
            setTimeout(() => verifyAndStartMonitoring(), 3000);
          }
          return;
        }
        
        if (!data || !data.is_active) {
          return;
        }

        // Verificar periodicamente se a sessão ainda está ativa
        const checkSessionStatus = async () => {
          try {
            const { data, error } = await (supabase
              .from('user_sessions' as any)
              .select('is_active, session_token')
              .eq('session_token', sessionToken)
              .eq('user_id', user.id)
              .single() as any) as { data: { is_active: boolean; session_token: string } | null; error: any };

            if (error) {
              // Se erro 406 (not found), a sessão foi deletada
              if (error.code === 'PGRST116' || error.message?.includes('No rows')) {
                handleSessionInvalidated();
              }
            } else if (!data || !data.is_active) {
              handleSessionInvalidated();
            }
          } catch (error) {
            console.error('🔐 [SessionMonitor] Erro ao verificar sessão:', error);
          }
        };

        // Verificar a cada 3 segundos (mais frequente para detectar mais rápido)
        // Isso garante detecção mesmo se o Realtime falhar
        checkIntervalRef.current = setInterval(checkSessionStatus, 3000);

        // Listener Realtime para mudanças na sessão
        // Usar um nome de canal único mas estável
        const channelName = `user-session-monitor-${user.id}`;
        
        const channel = supabase
          .channel(channelName)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'user_sessions',
              filter: `user_id=eq.${user.id}`,
            },
            (payload: any) => {
              const currentSessionToken = localStorage.getItem('sessionToken');
              
              // Verificar se a sessão atual foi invalidada
              // IMPORTANTE: Verificar se o token corresponde E se foi desativado
              if (
                payload.new.session_token === currentSessionToken &&
                payload.new.is_active === false &&
                (payload.old?.is_active === true || payload.old?.is_active === undefined)
              ) {
                handleSessionInvalidated();
              }
            }
          )
          .subscribe((status) => {
            if (status === 'CHANNEL_ERROR') {
              console.error('🔐 [SessionMonitor] ❌ Erro na subscription Realtime');
            }
          });

        channelRef.current = channel;

        // Verificação inicial
        checkSessionStatus();

      } catch (error) {
        console.error('🔐 [SessionMonitor] Erro ao verificar sessão inicial:', error);
      }
    };

    // Aguardar um pouco antes de começar a monitorar para garantir que o login foi completado
    const initTimeout = setTimeout(() => {
      verifyAndStartMonitoring();
    }, 2000); // Aguardar 2 segundos após login para evitar conflitos

    return () => {
      clearTimeout(initTimeout);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      hasNotifiedRef.current = false;
    };
  }, [user?.id, logout]);
};

