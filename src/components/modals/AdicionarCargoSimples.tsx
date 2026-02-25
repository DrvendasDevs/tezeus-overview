import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface AdicionarCargoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCargo: (cargo: { nome: string; tipo: string; funcao: string }) => void;
  loading?: boolean;
}

const permissoes = [
  { 
    id: "dashboard", 
    label: "Dashboard",
    subPermissions: [
      { id: "dashboard-item", label: "Dashboard" }
    ]
  },
  { 
    id: "conversas", 
    label: "Conversas",
    subPermissions: [
      { id: "conversas-item", label: "Conversas" }
    ]
  },
  { 
    id: "conversas-rapidas", 
    label: "Conversas Rápidas",
    subPermissions: [
      { id: "conversas-rapidas-item", label: "Conversas Rápidas" }
    ]
  },
  { 
    id: "conexoes", 
    label: "Conexões",
    subPermissions: [
      { id: "conexoes-item", label: "Conexões" }
    ]
  },
  { 
    id: "workspace", 
    label: "Workspace",
    subPermissions: [
      { id: "workspace-empresas", label: "Empresas" },
      { id: "workspace-relatorios", label: "Relatórios" }
    ]
  },
  { 
    id: "crm", 
    label: "CRM",
    subPermissions: [
      { id: "crm-negocios", label: "Negócios" },
      { id: "crm-contatos", label: "Contatos" },
      { id: "crm-tags", label: "Tags" },
      { id: "crm-produtos", label: "Produtos" }
    ]
  },
  { 
    id: "administracao", 
    label: "Administração",
    subPermissions: [
      { id: "administracao-agente-virtual", label: "Agente Virtual" },
      { id: "administracao-filas", label: "Filas" },
      { id: "administracao-usuarios", label: "Usuários" },
      { id: "administracao-configuracoes", label: "Configurações" }
    ]
  }
];

export function AdicionarCargoModal({ isOpen, onClose, onAddCargo, loading }: AdicionarCargoModalProps) {
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Record<string, Record<string, boolean>>>({});
  const [isPermissionsOpen, setIsPermissionsOpen] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  
  // Estados para floating labels
  const [nomeIsFocused, setNomeIsFocused] = useState(false);
  const [tipoIsFocused, setTipoIsFocused] = useState(false);

  // Reset floating label states quando modal fechar
  useEffect(() => {
    if (!isOpen) {
      setNomeIsFocused(false);
      setTipoIsFocused(false);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nome && tipo) {
      // Derive funcao from tipo
      let funcao = tipo;
      if (tipo.includes('SDR')) {
        funcao = 'SDR';
      } else if (tipo.includes('BDR')) {
        funcao = 'BDR';
      } else if (tipo.includes('CLOSER')) {
        funcao = 'CLOSER';
      } else if (tipo === 'Suporte') {
        funcao = 'SUPORTE';
      } else if (tipo === 'Atendente') {
        funcao = 'ATENDENTE';
      } else {
        funcao = 'PADRAO';
      }
      
      onAddCargo({ nome, tipo, funcao });
      setNome("");
      setTipo("");
      setSelectedPermissions({});
      setExpandedModules(new Set());
      // Reset floating label states
      setNomeIsFocused(false);
      setTipoIsFocused(false);
      setIsPermissionsOpen(false);
      onClose();
    }
  };

  const handleSelectAll = () => {
    const allSelected: Record<string, Record<string, boolean>> = {};
    permissoes.forEach(permissao => {
      permissao.subPermissions.forEach(sub => {
        if (!allSelected[sub.id]) {
          allSelected[sub.id] = {};
        }
        ['ver', 'criar', 'editar', 'deletar'].forEach(action => {
          allSelected[sub.id][action] = true;
        });
      });
    });
    setSelectedPermissions(allSelected);
  };

  const handleDeselectAll = () => {
    setSelectedPermissions({});
  };

  const toggleModule = (moduleId: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const handleSubPermissionChange = (subPermissionId: string, action: string, checked: boolean) => {
    setSelectedPermissions(prev => ({
      ...prev,
      [subPermissionId]: {
        ...prev[subPermissionId],
        [action]: checked
      }
    }));
  };


  const isFormValid = nome && tipo;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-white border border-gray-200 rounded-lg shadow-lg p-8 overflow-y-auto">
        <DialogHeader className="mb-6">
          <DialogTitle className="text-lg font-normal text-gray-900 text-left">
            Adicionar cargo
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Campo Nome com Floating Label */}
            <div className="relative">
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                onFocus={() => setNomeIsFocused(true)}
                onBlur={() => setNomeIsFocused(false)}
                className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
              />
              <label 
                className={`absolute left-3 transition-all duration-200 pointer-events-none px-2 ${
                  nomeIsFocused || nome ? 
                  '-top-2 text-xs text-primary font-medium' :
                  'top-1/2 -translate-y-1/2 text-gray-500'
                }`}
                style={{ backgroundColor: 'white' }}
              >
                Nome
              </label>
            </div>

            {/* Campo Tipo de cargo com Floating Label */}
            <div className="relative">
              <select 
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                onFocus={() => setTipoIsFocused(true)}
                onBlur={() => setTipoIsFocused(false)}
                className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background appearance-none rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
              >
                <option value="" disabled hidden></option>
                <option value="Padrão">Padrão</option>
                <option value="Pré-vendedor(SDR)">Pré-vendedor(SDR)</option>
                <option value="Pré-vendedor(BDR)">Pré-vendedor(BDR)</option>
                <option value="Vendedor(CLOSER)">Vendedor(CLOSER)</option>
                <option value="Suporte">Suporte</option>
                <option value="Atendente">Atendente</option>
              </select>
              <label 
                className={`absolute left-3 transition-all duration-200 pointer-events-none px-2 ${
                  tipoIsFocused || tipo ? 
                  '-top-2 text-xs text-primary font-medium' : 
                  'top-1/2 -translate-y-1/2 text-gray-500'
                }`}
                style={{ backgroundColor: 'white' }}
              >
                Tipo de cargo
              </label>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                <ChevronDown className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          </div>

          {/* Permissões de Acesso */}
          <div className="space-y-2">
            <label className="text-sm text-gray-600 font-normal">Permissões de Acesso</label>
            <Collapsible open={isPermissionsOpen} onOpenChange={setIsPermissionsOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full bg-white border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 justify-between h-10"
                  type="button"
                >
                  Permissões de Acesso
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isPermissionsOpen ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="bg-white border border-gray-200 rounded-md shadow-sm p-4">
                  {/* Botões de ação */}
                  <div className="flex gap-2 mb-4">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleSelectAll}
                      className="bg-background text-primary border-primary hover:bg-accent text-xs px-3 py-1 h-8"
                    >
                      Selecionar Tudo
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleDeselectAll}
                      className="bg-background text-primary border-primary hover:bg-accent text-xs px-3 py-1 h-8"
                    >
                      Desmarcar Tudo
                    </Button>
                  </div>
                  
                  {/* Lista de permissões */}
                  <div className="space-y-2">
                    {permissoes.map((permissao) => (
                      <div key={permissao.id} className="border border-gray-200 rounded-md">
                        {/* Header do módulo */}
                        <button
                          type="button"
                          onClick={() => toggleModule(permissao.id)}
                          className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-50"
                        >
                          <span className="text-sm text-gray-700 font-normal">
                            {permissao.label}
                          </span>
                          <ChevronDown className={`h-4 w-4 transition-transform ${expandedModules.has(permissao.id) ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {/* Conteúdo expandido */}
                        {expandedModules.has(permissao.id) && (
                          <div className="border-t border-gray-200 p-3">
                            {/* Tabela de permissões */}
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-gray-200">
                                    <th className="text-left py-2 font-normal text-gray-600">Funcionalidade</th>
                                    <th className="text-center py-2 font-normal text-gray-600">Ver</th>
                                    <th className="text-center py-2 font-normal text-gray-600">Criar</th>
                                    <th className="text-center py-2 font-normal text-gray-600">Editar</th>
                                    <th className="text-center py-2 font-normal text-gray-600">Deletar</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {permissao.subPermissions.map(sub => (
                                    <tr key={sub.id} className="border-b border-gray-100">
                                      <td className="py-2 text-gray-700">{sub.label}</td>
                                      {['ver', 'criar', 'editar', 'deletar'].map(action => (
                                        <td key={action} className="py-2 text-center">
                                          <Checkbox
                                            checked={selectedPermissions[sub.id]?.[action] || false}
                                            onCheckedChange={(checked) => 
                                              handleSubPermissionChange(sub.id, action, checked as boolean)
                                            }
                                            className="border-input data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                          />
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="bg-transparent border border-red-500 text-red-500 hover:bg-red-50 px-6 py-2 rounded-md text-sm font-normal"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!isFormValid || loading}
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-6 py-2 rounded-md text-sm font-normal disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}