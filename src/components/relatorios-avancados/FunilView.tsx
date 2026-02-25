import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveContainer, FunnelChart, Funnel, Tooltip, LabelList } from "recharts";

interface FunilViewProps {
  data: any[];
}

export function FunilView({ data }: FunilViewProps) {
  // Mock data for funnel
  const funnelData = [
    {
      value: 100,
      name: 'Entrada',
      fill: '#8884d8',
    },
    {
      value: 80,
      name: 'Qualificação',
      fill: '#83a6ed',
    },
    {
      value: 50,
      name: 'Proposta',
      fill: '#8dd1e1',
    },
    {
      value: 40,
      name: 'Negociação',
      fill: '#82ca9d',
    },
    {
      value: 26,
      name: 'Fechamento',
      fill: '#a4de6c',
    },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Funil de Conversão</CardTitle>
          <CardDescription>Visualização do fluxo de vendas</CardDescription>
        </CardHeader>
        <CardContent className="h-[500px]">
          <ResponsiveContainer width="100%" height="100%">
            <FunnelChart>
              <Tooltip />
              <Funnel
                dataKey="value"
                data={funnelData}
                isAnimationActive
              >
                <LabelList position="right" fill="#000" stroke="none" dataKey="name" />
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
         {funnelData.map((stage, index) => (
            <Card key={index}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stage.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stage.value}</div>
                <p className="text-xs text-muted-foreground">
                   Oportunidades
                </p>
              </CardContent>
            </Card>
         ))}
      </div>
    </div>
  );
}


