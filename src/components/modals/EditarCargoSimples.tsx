import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Cargo {
  id: string;
  nome: string;
  tipo: string;
  funcao: string;
  created_at: string;
  updated_at: string;
}

interface EditarCargoSimplesProps {
  isOpen: boolean;
  onClose: () => void;
  onEditCargo: (cargo: Cargo) => void;
  cargo?: Cargo;
  loading?: boolean;
}

export function EditarCargoSimples({ isOpen, onClose, onEditCargo, cargo, loading }: EditarCargoSimplesProps) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("");
  const [funcao, setFuncao] = useState("");

  useEffect(() => {
    if (cargo) {
      setNome(cargo.nome);
      setTipo(cargo.tipo);
      setFuncao(cargo.funcao);
    }
  }, [cargo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cargo && nome.trim() && tipo.trim() && funcao.trim()) {
      onEditCargo({
        ...cargo,
        nome: nome.trim(),
        tipo: tipo.trim(),
        funcao: funcao.trim(),
        updated_at: new Date().toISOString()
      });
      setNome("");
      setTipo("");
      setFuncao("");
    }
  };

  const handleClose = () => {
    setNome("");
    setTipo("");
    setFuncao("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Cargo</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome do cargo</Label>
            <Input
              id="nome"
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Analista de Vendas"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo do cargo</Label>
            <Input
              id="tipo"
              type="text"
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              placeholder="Ex: Vendedor"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="funcao">Função</Label>
            <Input
              id="funcao"
              type="text"
              value={funcao}
              onChange={(e) => setFuncao(e.target.value)}
              placeholder="Ex: VENDAS"
              required
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={loading || !nome.trim() || !tipo.trim() || !funcao.trim()}
            >
              {loading ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}