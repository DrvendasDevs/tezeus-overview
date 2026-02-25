import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from "recharts";

interface BIViewProps {
  data: any[];
}

export function BIView({ data }: BIViewProps) {
  // Mock data aggregation for charts
  const messageData = [
    { name: 'Seg', mensagens: 400 },
    { name: 'Ter', mensagens: 300 },
    { name: 'Qua', mensagens: 550 },
    { name: 'Qui', mensagens: 450 },
    { name: 'Sex', mensagens: 600 },
    { name: 'Sab', mensagens: 200 },
    { name: 'Dom', mensagens: 100 },
  ];

  const statusData = [
    { name: 'Ganho', value: data.filter(d => d.status === 'won').length },
    { name: 'Perdido', value: data.filter(d => d.status === 'lost').length },
    { name: 'Aberto', value: data.filter(d => d.status === 'open').length },
  ];

  const COLORS = ['#10B981', '#EF4444', '#3B82F6'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Mensagens ao Longo do Tempo</CardTitle>
          <CardDescription>Volume de mensagens nos últimos 7 dias</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={messageData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="mensagens" stroke="#8884d8" activeDot={{ r: 8 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status dos Negócios</CardTitle>
          <CardDescription>Distribuição atual do pipeline</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ganhos vs Perdas</CardTitle>
          <CardDescription>Comparativo por período</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                { name: 'Semana 1', ganhos: 4000, perdas: 2400 },
                { name: 'Semana 2', ganhos: 3000, perdas: 1398 },
                { name: 'Semana 3', ganhos: 2000, perdas: 9800 },
                { name: 'Semana 4', ganhos: 2780, perdas: 3908 },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="ganhos" fill="#10B981" />
              <Bar dataKey="perdas" fill="#EF4444" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}


