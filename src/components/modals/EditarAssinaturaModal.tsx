import { Dialog, DialogContent } from "@/components/ui/dialog";

interface Assinatura {
  id: string;
  status: string;
  dataVencimento: string;
}

interface EditarAssinaturaModalProps {
  isOpen: boolean;
  onClose: () => void;
  assinatura: Assinatura | null;
}

export function EditarAssinaturaModal({ isOpen, onClose, assinatura }: EditarAssinaturaModalProps) {
  if (!assinatura) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="min-w-[70vw] h-[85vh] max-h-[85vh] overflow-hidden bg-muted/50 rounded-lg p-0 top-[7.5vh] translate-y-0">
        <div className="p-6 h-full flex flex-col">
          {/* Card interno com sombra */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 px-6 pt-6 pb-0 flex flex-col">
            {/* Cabeçalho */}
            <div className="">
              <h6 className="text-lg font-medium text-gray-900 mb-4">
                Informações da Assinatura
              </h6>
              <hr className="border-gray-300" style={{ marginBottom: "16px" }} />
            </div>
            
            {/* Campos */}
            <div className="space-y-0">
              <div className="flex justify-between items-center py-2">
                <p className="text-gray-900 text-base">ID:</p>
                <p className="text-gray-900 text-base">#{assinatura.id}</p>
              </div>
              
              <div className="flex justify-between items-center py-2">
                <p className="text-gray-900 text-base">Status:</p>
                <p 
                  className={`text-base ${assinatura.status === "Ativo" ? "text-green-600" : "text-[rgb(255,20,20)]"}`}
                >
                  {assinatura.status}
                </p>
              </div>
              
              <div className="flex justify-between items-center py-2 pb-4">
                <p className="text-gray-900 text-base">Data de Vencimento:</p>
                <p className="text-gray-900 text-base">{assinatura.dataVencimento}</p>
              </div>
            </div>
          </div>
          
          {/* Texto informativo */}
          <div className="mt-6 mb-8 text-center">
            <p className="text-gray-500 text-sm">
              Esta assinatura não possui um pedido vinculado.
            </p>
          </div>
          
          {/* Botão fechar */}
          <div className="flex justify-end mt-auto pt-4 border-t border-gray-200">
            <button 
              onClick={onClose}
              className="text-primary hover:text-primary/90 text-sm font-medium uppercase tracking-wide border-0 bg-transparent"
            >
              Fechar
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}