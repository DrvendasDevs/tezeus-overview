import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit } from "lucide-react";
import { useState } from "react";
import { EditarAssinaturaModal } from "@/components/modals/EditarAssinaturaModal";

interface Assinatura {
  id: string;
  status: string;
  dataVencimento: string;
}

export function AdministracaoFinanceiro() {
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAssinatura, setSelectedAssinatura] = useState<Assinatura | null>(null);

  const assinaturas = [
    {
      id: "808",
      status: "Inativo",
      dataVencimento: "23/08/2025",
    },
    {
      id: "1248",
      status: "Ativo",
      dataVencimento: "21/09/2025",
    },
  ];

  const handleEditAssinatura = (assinatura: Assinatura) => {
    setSelectedAssinatura(assinatura);
    setIsEditModalOpen(true);
  };

  return (
    <div className="p-2 h-screen">
      <div className="bg-white rounded-lg shadow-md border border-gray-200/50 h-[calc(100vh-1rem)] flex flex-col">
        <div className="p-6 flex-shrink-0">
          <h1 className="text-2xl font-bold text-black">Assinaturas</h1>
        </div>
        
        <div className="flex-1 px-6 pb-6">
          <div className="bg-white">
            <Table>
              <TableHeader>
                <TableRow className="border-b border-gray-200">
                  <TableHead className="text-left font-medium text-gray-700">Id</TableHead>
                  <TableHead className="text-left font-medium text-gray-700">Status</TableHead>
                  <TableHead className="text-left font-medium text-gray-700">Data Venc.</TableHead>
                  <TableHead className="text-left font-medium text-gray-700">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assinaturas.map((assinatura) => (
                  <TableRow key={assinatura.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <TableCell className="font-medium text-gray-900">
                      {assinatura.id}
                    </TableCell>
                    <TableCell>
                      <span 
                        className={assinatura.status === "Ativo" ? "text-[#43A047]" : "text-[#E53935]"}
                      >
                        {assinatura.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-700">
                      {assinatura.dataVencimento}
                    </TableCell>
                    <TableCell>
                      <Edit 
                        className="w-4 h-4 text-gray-400 cursor-pointer hover:text-gray-600" 
                        onClick={() => handleEditAssinatura(assinatura)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        
        <EditarAssinaturaModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedAssinatura(null);
          }}
          assinatura={selectedAssinatura}
        />
      </div>
    </div>
  );
}