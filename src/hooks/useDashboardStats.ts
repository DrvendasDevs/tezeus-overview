import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface DashboardStats {
  totalConnections: number;
  activeConnections: number;
  totalConversations: number;
  activeConversations: number;
  todayMessages: number;
  pendingTasks: number;
  activePipelineDeals: number;
  todayRevenue: number;
}

export const useDashboardStats = (workspaceId?: string) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalConnections: 0,
    activeConnections: 0,
    totalConversations: 0,
    activeConversations: 0,
    todayMessages: 0,
    pendingTasks: 0,
    activePipelineDeals: 0,
    todayRevenue: 0,
  });
  const [isLoading, setIsLoading] = useState(false);

  const fetchStats = async () => {
    if (!workspaceId) {
      console.log('⏭️ [useDashboardStats] Sem workspaceId, ignorando');
      return;
    }
    
    console.log('📊 [useDashboardStats] Buscando estatísticas para workspace:', workspaceId);
    setIsLoading(true);
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Fetch connections filtered by workspace
      const { data: connections, error: connectionsError } = await supabase
        .from('connections')
        .select('status')
        .eq('workspace_id', workspaceId);

      console.log('🔌 [useDashboardStats] Connections:', {
        count: connections?.length || 0,
        error: connectionsError,
        workspaceId
      });

      // Fetch conversations filtered by workspace
      const { data: conversations, error: conversationsError } = await supabase
        .from('conversations')
        .select('status, created_at')
        .eq('workspace_id', workspaceId);

      console.log('💬 [useDashboardStats] Conversations:', {
        total: conversations?.length || 0,
        open: conversations?.filter(c => c.status === 'open').length || 0,
        statuses: conversations?.map(c => c.status),
        error: conversationsError,
        workspaceId
      });

      // Fetch today's messages filtered by workspace
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('id')
        .eq('workspace_id', workspaceId)
        .gte('created_at', today.toISOString());

      console.log('📨 [useDashboardStats] Messages:', {
        todayCount: messages?.length || 0,
        error: messagesError
      });

      // Fetch activities (tasks) filtered by workspace
      const { data: activities, error: activitiesError } = await supabase
        .from('activities')
        .select('is_completed')
        .eq('workspace_id', workspaceId);

      console.log('✅ [useDashboardStats] Activities:', {
        total: activities?.length || 0,
        pending: activities?.filter(a => !a.is_completed).length || 0,
        error: activitiesError
      });

      const totalConnections = connections?.length || 0;
      const activeConnections = connections?.filter(c => c.status === 'connected').length || 0;
      const totalConversations = conversations?.length || 0;
      const activeConversations = conversations?.filter(c => c.status === 'open').length || 0;
      const todayMessages = messages?.length || 0;
      const pendingTasks = activities?.filter(a => !a.is_completed).length || 0;

      const newStats = {
        totalConnections,
        activeConnections,
        totalConversations,
        activeConversations,
        todayMessages,
        pendingTasks,
        activePipelineDeals: 0, // TODO: Implement when deals table exists
        todayRevenue: 0, // TODO: Implement when sales data exists
      };

      console.log('📊 [useDashboardStats] Stats calculadas:', newStats);

      setStats(newStats);
    } catch (error) {
      console.error('❌ [useDashboardStats] Error fetching dashboard stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [workspaceId]);

  return {
    stats,
    isLoading,
    refetch: fetchStats,
  };
};