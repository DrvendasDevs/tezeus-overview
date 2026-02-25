import { useWorkspaceAnalytics } from "@/hooks/useWorkspaceAnalytics";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/hooks/useAuth";
import { useWorkspaceStatusCheck } from "@/hooks/useWorkspaceStatusCheck";
import { MessageCircle, Users, TrendingUp, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";

import { cn } from "@/lib/utils";

// Inline KPICard component
function AnalyticsKPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  isLoading
}: any) {
  if (isLoading) return <Skeleton className="h-32 w-full rounded-none" />;
  return <Card className="rounded-none border border-[#d4d4d4] shadow-sm dark:border-gray-700 dark:bg-[#1f1f1f] transition-all duration-300 ease-in-out">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 bg-[#f0f0f0] border-b border-[#d4d4d4] p-3 dark:bg-[#2d2d2d] dark:border-gray-700 transition-all duration-300 ease-in-out">
        <CardTitle className="text-xs font-bold text-gray-700 dark:text-gray-200 transition-colors duration-300 ease-in-out">{title}</CardTitle>
        <Icon className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400 transition-colors duration-300 ease-in-out" />
      </CardHeader>
      <CardContent className="p-4">
        <div className="text-xl font-bold text-gray-900 dark:text-white transition-colors duration-300 ease-in-out">{value}</div>
        <p className="text-[10px] text-gray-500 mt-1 dark:text-gray-400 transition-colors duration-300 ease-in-out">{subtitle}</p>
      </CardContent>
    </Card>;
}
export function Dashboard({
  isDarkMode
}: {
  isDarkMode?: boolean;
}) {
  const {
    analytics,
    isLoading
  } = useWorkspaceAnalytics();
  const {
    selectedWorkspace,
    isLoadingWorkspaces
  } = useWorkspace();
  const {
    userRole
  } = useAuth();

  // Monitorar status do workspace
  useWorkspaceStatusCheck();
  const isMasterRole = userRole === 'master';

  // Loading state
  if (isLoadingWorkspaces || !selectedWorkspace || isLoading) {
    return <div className="bg-white border border-[#d4d4d4] m-2 shadow-sm min-h-[calc(100vh-1rem)] flex flex-col dark:bg-[#1f1f1f] dark:border-gray-700">
        <div className="h-8 bg-primary/10 w-full animate-pulse" />
        <div className="p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Array.from({
            length: 4
          }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-none dark:bg-gray-800" />)}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-64 w-full rounded-none dark:bg-gray-800" />
            <Skeleton className="h-64 w-full rounded-none dark:bg-gray-800" />
          </div>
        </div>
      </div>;
  }

  // Data for Charts
  const pieData = [{
    name: 'Em Andamento',
    value: analytics.dealsInProgress
  }, {
    name: 'Ganhos',
    value: analytics.completedDeals
  }, {
    name: 'Perdidos',
    value: analytics.lostDeals
  }].filter(d => d.value > 0);
  const COLORS = ['#3B82F6', '#10B981', '#EF4444']; // Blue, Green, Red

  return <div className="flex flex-col h-full bg-white border border-[#d4d4d4] m-2 shadow-sm font-sans text-xs overflow-auto dark:bg-[#1f1f1f] dark:border-gray-700 transition-all duration-300 ease-in-out">
      <div className="px-4 pt-3 pb-2">
        <h1
          className="font-bold text-gray-900 dark:text-gray-100"
          style={{ fontSize: "1.5rem" }}
        >
          Relatórios
        </h1>
      </div>

      <div className="p-4 space-y-4">
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <AnalyticsKPICard title="Conversas Ativas" value={analytics.activeConversations} subtitle={`${analytics.totalConversations} conversas no total`} icon={MessageCircle} isLoading={isLoading} />
          
          <AnalyticsKPICard title="Atendimentos em Andamento" value={analytics.dealsInProgress} subtitle="Negócios em pipeline" icon={Users} isLoading={isLoading} />
          
          <AnalyticsKPICard title="Vendas Concluídas" value={analytics.completedDeals} subtitle="Deals fechados" icon={TrendingUp} isLoading={isLoading} />
          
          <AnalyticsKPICard title="Taxa de Conversão" value={`${analytics.conversionRate.toFixed(1)}%`} subtitle="Vendas vs. Total de closes" icon={Target} isLoading={isLoading} />
        </div>

        {/* Charts Grid */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Deals Status Chart (Pie) */}
          <Card className="rounded-none border border-[#d4d4d4] shadow-sm dark:border-gray-700 dark:bg-[#1f1f1f] transition-all duration-300 ease-in-out">
            <CardHeader className="bg-[#f0f0f0] border-b border-[#d4d4d4] p-3 rounded-none dark:bg-[#2d2d2d] dark:border-gray-700 transition-all duration-300 ease-in-out">
              <CardTitle className="text-xs font-bold text-gray-700 dark:text-gray-200 transition-colors duration-300 ease-in-out">Status dos Negócios</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] p-4">
              {pieData.length > 0 ? <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '0px', border: '1px solid #d4d4d4', fontSize: '12px', backgroundColor: isDarkMode ? '#2d2d2d' : '#fff', color: isDarkMode ? '#fff' : '#000' }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
               </ResponsiveContainer> : <div className="h-full flex items-center justify-center text-muted-foreground text-xs dark:text-gray-400">
                      Sem dados para exibir
                  </div>}
            </CardContent>
          </Card>

          {/* Trends Chart (Line) */}
          <Card className="rounded-none border border-[#d4d4d4] shadow-sm dark:border-gray-700 dark:bg-[#1f1f1f] transition-all duration-300 ease-in-out">
              <CardHeader className="bg-[#f0f0f0] border-b border-[#d4d4d4] p-3 rounded-none dark:bg-[#2d2d2d] dark:border-gray-700 transition-all duration-300 ease-in-out">
                  <CardTitle className="text-xs font-bold text-gray-700 dark:text-gray-200 transition-colors duration-300 ease-in-out">Tendência de Conversas (7 dias)</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px] p-4">
                  {analytics.conversationTrends.length > 0 ? <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={analytics.conversationTrends}>
                              <CartesianGrid strokeDasharray="3 3" stroke={isDarkMode ? "#444" : "#e5e7eb"} />
                              <XAxis 
                                dataKey="date" 
                                tickFormatter={val => new Date(val).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit'
                                })} 
                                tick={{ fontSize: 10, fill: isDarkMode ? '#9ca3af' : '#6b7280' }}
                                axisLine={{ stroke: isDarkMode ? '#4b5563' : '#d4d4d4' }}
                                tickLine={{ stroke: isDarkMode ? '#4b5563' : '#d4d4d4' }}
                              />
                              <YAxis 
                                tick={{ fontSize: 10, fill: isDarkMode ? '#9ca3af' : '#6b7280' }}
                                axisLine={{ stroke: isDarkMode ? '#4b5563' : '#d4d4d4' }}
                                tickLine={{ stroke: isDarkMode ? '#4b5563' : '#d4d4d4' }}
                              />
                              <Tooltip 
                                labelFormatter={val => new Date(val).toLocaleDateString('pt-BR')} 
                                contentStyle={{ borderRadius: '0px', border: '1px solid #d4d4d4', fontSize: '12px', backgroundColor: isDarkMode ? '#2d2d2d' : '#fff', color: isDarkMode ? '#fff' : '#000' }}
                              />
                              <Legend wrapperStyle={{ fontSize: '11px' }} />
                              <Line type="monotone" dataKey="count" name="Conversas" stroke="#8884d8" strokeWidth={2} activeDot={{
                  r: 6
                }} dot={{ r: 3 }} />
                          </LineChart>
                      </ResponsiveContainer> : <div className="h-full flex items-center justify-center text-muted-foreground text-xs dark:text-gray-400">
                          Sem dados para exibir
                      </div>}
              </CardContent>
          </Card>
        </div>
      </div>
    </div>;
}