import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, ThumbsDown, Target, Clock, MessageSquare, CheckCircle } from "lucide-react";

interface KPIStats {
  totalWon: number;
  totalLost: number;
  conversionRate: number;
  avgResponseTime: number;
  totalMessages: number;
  opportunitiesCreated: number;
}

interface KPIsViewProps {
  data: any[]; // In a real scenario, data might be pre-aggregated or raw
}

export function KPIsView({ data }: KPIsViewProps) {
  // Calculate mock stats from data or use static for now if data is raw
  const stats: KPIStats = {
    totalWon: data.filter(d => d.status === 'won').reduce((acc, curr) => acc + curr.value, 0),
    totalLost: data.filter(d => d.status === 'lost').length,
    conversionRate: data.length > 0 ? (data.filter(d => d.status === 'won').length / data.length) * 100 : 0,
    avgResponseTime: 15, // Mock
    totalMessages: 1250, // Mock
    opportunitiesCreated: data.length,
  };

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="bg-white dark:bg-[#111111] border border-[#d4d4d4] dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-800 dark:text-gray-100">Ganho Total</CardTitle>
          <DollarSign className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(stats.totalWon)}
          </div>
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            +20.1% em relação ao mês passado
          </p>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-[#111111] border border-[#d4d4d4] dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-800 dark:text-gray-100">Negócios Perdidos</CardTitle>
          <ThumbsDown className="h-4 w-4 text-red-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalLost}</div>
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            -4% em relação ao mês passado
          </p>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-[#111111] border border-[#d4d4d4] dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-800 dark:text-gray-100">Taxa de Conversão</CardTitle>
          <Target className="h-4 w-4 text-blue-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.conversionRate.toFixed(1)}%</div>
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            +12% em relação ao mês passado
          </p>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-[#111111] border border-[#d4d4d4] dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-800 dark:text-gray-100">Tempo Médio Resp.</CardTitle>
          <Clock className="h-4 w-4 text-yellow-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.avgResponseTime} min</div>
          <p className="text-xs text-muted-foreground dark:text-gray-400">
            -2 min em relação ao mês passado
          </p>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-[#111111] border border-[#d4d4d4] dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-800 dark:text-gray-100">Mensagens Totais</CardTitle>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalMessages}</div>
        </CardContent>
      </Card>

      <Card className="bg-white dark:bg-[#111111] border border-[#d4d4d4] dark:border-gray-700">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-800 dark:text-gray-100">Oportunidades</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.opportunitiesCreated}</div>
        </CardContent>
      </Card>
    </div>
  );
}

