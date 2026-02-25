import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ListaViewProps {
  data: any[];
}

export function ListaView({ data }: ListaViewProps) {
  return (
    <div className="bg-white dark:bg-[#1f1f1f] border border-[#d4d4d4] dark:border-gray-700 shadow-sm">
      <div className="grid grid-cols-7 bg-[#f3f3f3] dark:bg-[#2d2d2d] border-b border-[#d4d4d4] dark:border-gray-700 sticky top-0 z-10">
        <div className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border-r border-[#d4d4d4] dark:border-gray-700 flex items-center justify-center">
          <Checkbox className="h-3.5 w-3.5" />
        </div>
        <div className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border-r border-[#d4d4d4] dark:border-gray-700">
          Título
        </div>
        <div className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border-r border-[#d4d4d4] dark:border-gray-700">
          Status
        </div>
        <div className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border-r border-[#d4d4d4] dark:border-gray-700">
          Responsável
        </div>
        <div className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border-r border-[#d4d4d4] dark:border-gray-700">
          Valor
        </div>
        <div className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300 border-r border-[#d4d4d4] dark:border-gray-700">
          Criado em
        </div>
        <div className="px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
          Pipeline
        </div>
      </div>

      {data.length === 0 ? (
        <div className="px-3 py-8 text-center text-xs text-gray-500 dark:text-gray-400">
          Nenhum registro encontrado
        </div>
      ) : (
        data.map((item) => (
          <div
            key={item.id}
            className="grid grid-cols-7 border-b border-[#d4d4d4] dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] dark:border-gray-700 flex items-center justify-center">
              <Checkbox className="h-3.5 w-3.5" />
            </div>
            <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] dark:border-gray-700 font-medium text-gray-800 dark:text-gray-200">
              {item.title}
            </div>
            <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] dark:border-gray-700">
              <Badge
                variant={
                  item.status === 'won' ? 'default' :
                  item.status === 'lost' ? 'destructive' :
                  'secondary'
                }
                className={
                  item.status === 'won' ? 'bg-green-500 hover:bg-green-600 text-[10px] px-1.5 py-0 h-5' :
                  item.status === 'lost' ? 'bg-red-500 hover:bg-red-600 text-[10px] px-1.5 py-0 h-5' :
                  'bg-blue-500 hover:bg-blue-600 text-white text-[10px] px-1.5 py-0 h-5'
                }
              >
                {item.status === 'won' ? 'Ganho' :
                 item.status === 'lost' ? 'Perdido' :
                 'Aberto'}
              </Badge>
            </div>
            <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] dark:border-gray-700 text-gray-600 dark:text-gray-400">
              {item.responsible}
            </div>
            <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] dark:border-gray-700 text-gray-800 dark:text-gray-200">
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL'
              }).format(item.value)}
            </div>
            <div className="px-3 py-2.5 text-xs border-r border-[#d4d4d4] dark:border-gray-700 text-gray-600 dark:text-gray-400">
              {format(new Date(item.createdAt), 'dd/MM/yyyy', { locale: ptBR })}
            </div>
            <div className="px-3 py-2.5 text-xs text-gray-600 dark:text-gray-400">
              {item.pipeline}
            </div>
          </div>
        ))
      )}
      
      <div className="flex items-center justify-end gap-2 py-2 px-3 border-t border-[#d4d4d4] dark:border-gray-700 bg-[#f3f3f3] dark:bg-[#2d2d2d]">
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs rounded-none hover:bg-gray-200 dark:hover:bg-gray-700 border border-transparent hover:border-gray-300 dark:hover:border-gray-600">Anterior</Button>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs rounded-none hover:bg-gray-200 dark:hover:bg-gray-700 border border-transparent hover:border-gray-300 dark:hover:border-gray-600">Próximo</Button>
      </div>
    </div>
  );
}


