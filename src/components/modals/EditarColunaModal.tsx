import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { ColumnAutomationsTab } from "./ColumnAutomationsTab";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { Trash2, User } from "lucide-react";
import { DeletarColunaModal } from "./DeletarColunaModal";
import { useAuth } from "@/hooks/useAuth";

interface EditarColunaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columnId: string | null;
  columnName: string;
  columnColor: string;
  columnIcon?: string;
  onUpdate: () => void;
  isDarkMode?: boolean;
}

export function EditarColunaModal({
  open,
  onOpenChange,
  columnId,
  columnName,
  columnColor,
  columnIcon = 'Circle',
  onUpdate,
  isDarkMode = false,
}: EditarColunaModalProps) {
  const [name, setName] = useState(columnName);
  const [color, setColor] = useState(columnColor);
  const [icon, setIcon] = useState(columnIcon);
  const [isOfferStage, setIsOfferStage] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('settings');
  const [viewAllDealsUsers, setViewAllDealsUsers] = useState<string[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const { toast } = useToast();
  const { getHeaders } = useWorkspaceHeaders();
  const { selectedWorkspace } = useWorkspace();
  const { members } = useWorkspaceMembers(selectedWorkspace?.workspace_id);
  const { user } = useAuth();

  useEffect(() => {
    if (open && columnId) {
      setName(columnName);
      setColor(columnColor);
      setIcon(columnIcon || 'Circle');
      setIsOfferStage(false);
      setActiveTab('settings');
      loadViewAllPermissions();
    }
  }, [open, columnId, columnName, columnColor, columnIcon]);

  const loadViewAllPermissions = async () => {
    if (!columnId) return;

    try {
      const { data, error } = await supabase
        .from('pipeline_columns')
        .select('view_all_deals_permissions, is_offer_stage')
        .eq('id', columnId)
        .single();

      if (error) throw error;

      const viewAllPermissions = data?.view_all_deals_permissions;
      setViewAllDealsUsers(Array.isArray(viewAllPermissions) ? viewAllPermissions.filter((p): p is string => typeof p === 'string') : []);
      setIsOfferStage(!!data?.is_offer_stage);
    } catch (error) {
      console.error('Erro ao carregar permissões de negócios:', error);
    }
  };


  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Erro",
        description: "O nome da etapa não pode estar vazio",
        variant: "destructive",
      });
      return;
    }

    if (!columnId) return;

    try {
      setIsLoading(true);
      const headers = getHeaders();

      console.log('🔍 Salvando coluna com dados:', { name: name.trim(), color, icon });

      const { error } = await supabase.functions.invoke(`pipeline-management/columns?id=${columnId}`, {
        method: 'PUT',
        headers,
        body: {
          name: name.trim(),
          color,
          icon,
          is_offer_stage: isOfferStage,
        },
      });

      if (error) throw error;

      // Garantir persistência do flag (caso a edge function ignore campos extras)
      try {
        const { error: flagError } = await supabase
          .from('pipeline_columns')
          .update({ is_offer_stage: isOfferStage })
          .eq('id', columnId);
        if (flagError) {
          console.warn('⚠️ Não foi possível persistir is_offer_stage via supabase.from:', flagError);
        }
      } catch (e) {
        console.warn('⚠️ Falha ao tentar persistir is_offer_stage diretamente:', e);
      }

      toast({
        title: "Sucesso",
        description: "Etapa atualizada com sucesso",
      });

      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao atualizar coluna:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar etapa",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!columnId) return;

    try {
      const headers = getHeaders();
      const { error } = await supabase.functions.invoke(`pipeline-management/columns?id=${columnId}`, {
        method: 'DELETE',
        headers,
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Etapa excluída com sucesso",
      });

      onUpdate();
      onOpenChange(false);
      setIsDeleteModalOpen(false);
    } catch (error: any) {
      console.error('Erro ao excluir coluna:', error);
      
      if (error.message?.includes('existing cards')) {
        toast({
          title: "Erro ao excluir etapa",
          description: "Não é possível excluir uma etapa que contém oportunidades. Mova as oportunidades para outra etapa primeiro.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro ao excluir etapa",
          description: "Erro ao excluir etapa",
          variant: "destructive",
        });
      }
    }
  };

  const handleUpdateViewAllDealsPermissions = async () => {
    if (!columnId) return;

    try {
      const headers = getHeaders();
      const { error } = await supabase.functions.invoke(`pipeline-management/columns?id=${columnId}`, {
        method: 'PUT',
        headers,
        body: {
          view_all_deals_permissions: viewAllDealsUsers,
        },
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Permissões de visualização atualizadas com sucesso",
      });
      onUpdate();
    } catch (error) {
      console.error('Erro ao atualizar permissões:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar permissões de visualização",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={`sm:max-w-[700px] max-h-[90vh] overflow-y-auto p-0 gap-0 border border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#0f0f0f] shadow-sm rounded-none ${isDarkMode ? 'dark' : ''}`}>
          <DialogHeader className="bg-primary dark:bg-transparent p-4 rounded-none m-0 border-b border-transparent dark:border-gray-700">
            <DialogTitle className="text-primary-foreground dark:text-white">Editar Etapa</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className={`grid w-full grid-cols-3 bg-gray-50 dark:bg-[#1a1a1a] rounded-none border-b border-[#d4d4d4] dark:border-gray-700`}>
              <TabsTrigger value="settings" className={`rounded-none data-[state=active]:bg-white dark:data-[state=active]:bg-[#111111] data-[state=active]:border-t-2 data-[state=active]:border-t-primary data-[state=active]:border-x data-[state=active]:border-x-[#d4d4d4] dark:data-[state=active]:border-x-gray-700 data-[state=active]:shadow-none text-gray-700 dark:text-gray-300`}>Configurações</TabsTrigger>
              <TabsTrigger value="permissions" className={`rounded-none data-[state=active]:bg-white dark:data-[state=active]:bg-[#111111] data-[state=active]:border-t-2 data-[state=active]:border-t-primary data-[state=active]:border-x data-[state=active]:border-x-[#d4d4d4] dark:data-[state=active]:border-x-gray-700 data-[state=active]:shadow-none text-gray-700 dark:text-gray-300`}>Permissões</TabsTrigger>
              <TabsTrigger value="automations" className={`rounded-none data-[state=active]:bg-white dark:data-[state=active]:bg-[#111111] data-[state=active]:border-t-2 data-[state=active]:border-t-primary data-[state=active]:border-x data-[state=active]:border-x-[#d4d4d4] dark:data-[state=active]:border-x-gray-700 data-[state=active]:shadow-none text-gray-700 dark:text-gray-300`}>Automações</TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="space-y-4 p-6 m-0">
              <div className="space-y-2">
                <Label htmlFor="column-name" className={`text-xs font-bold text-gray-700 dark:text-gray-200`}>Nome da Etapa</Label>
                <Input
                  id="column-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Digite o nome da coluna"
                  className={`h-8 text-xs rounded-none border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1b1b1b] text-gray-900 dark:text-gray-100 focus-visible:ring-0`}
                />
              </div>

            <div className="flex items-center gap-2 pt-2">
              <Checkbox
                id="is-offer-stage"
                checked={isOfferStage}
                onCheckedChange={(checked) => setIsOfferStage(!!checked)}
              />
              <Label htmlFor="is-offer-stage" className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                É Etapa de Oferta?
              </Label>
            </div>


              <DialogFooter className={`pt-4 flex-col sm:flex-row gap-2 bg-gray-50 dark:bg-[#1a1a1a] border-t border-[#d4d4d4] dark:border-gray-700 -mx-6 -mb-6 p-4 mt-4`}>
                <div className="flex gap-2 sm:mr-auto">
                  <Button 
                    variant="destructive" 
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="gap-2 h-8 text-xs rounded-none"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir Etapa
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)} className={`h-8 text-xs rounded-none border-gray-300 dark:border-gray-600 bg-white dark:bg-[#1b1b1b] text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#353535]`}>
                    Fechar
                  </Button>
                  <Button onClick={handleSave} disabled={isLoading || !name.trim()} className="h-8 text-xs rounded-none bg-primary hover:bg-primary/90">
                    {isLoading ? "Salvando..." : "Salvar Configurações"}
                  </Button>
                </div>
              </DialogFooter>
            </TabsContent>

            <TabsContent value="permissions" className="space-y-6 p-6 m-0">
              <div className="space-y-4">
                <div>
                  <h3 className={`text-sm font-bold mb-3 text-gray-800 dark:text-gray-200`}>Usuários que podem ver todas as oportunidades</h3>
                  <p className={`text-xs text-muted-foreground dark:text-gray-400 mb-3`}>
                    Usuários selecionados verão todas as oportunidades desta etapa independentemente do responsável.
                  </p>
                  <p className={`text-xs text-muted-foreground dark:text-gray-400 mb-3`}>
                    {viewAllDealsUsers.length} usuário{viewAllDealsUsers.length !== 1 ? 's' : ''} selecionado{viewAllDealsUsers.length !== 1 ? 's' : ''}
                  </p>
                  <div className={`space-y-2 max-h-[200px] overflow-y-auto border border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1b1b1b] p-3 scrollbar-thin scrollbar-thumb-yellow-500`}>
                    {members?.filter(member => !member.is_hidden).map(member => (
                      <div key={member.id} className={`flex items-center space-x-3 hover:bg-[#e6f2ff] dark:hover:bg-[#2a2a2a] p-1 -mx-1 rounded-none`}>
                        <Checkbox 
                          id={`view-all-${member.id}`}
                          checked={viewAllDealsUsers.includes(member.user_id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setViewAllDealsUsers([...viewAllDealsUsers, member.user_id]);
                            } else {
                              setViewAllDealsUsers(viewAllDealsUsers.filter(id => id !== member.user_id));
                            }
                          }}
                          className="rounded-none border-gray-300 dark:border-gray-700 data-[state=checked]:bg-primary"
                        />
                        <div className="flex items-center space-x-2 flex-1">
                          <Avatar className="h-6 w-6 rounded-none">
                            <AvatarFallback className={`rounded-none bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs`}>
                              <User className="h-3.5 w-3.5" />
                            </AvatarFallback>
                          </Avatar>
                          <label 
                            htmlFor={`view-all-${member.id}`} 
                            className={`text-xs font-medium cursor-pointer text-gray-700 dark:text-gray-300`}
                          >
                            {member.user?.name}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button 
                    className="w-full mt-3 h-8 text-xs rounded-none bg-primary hover:bg-primary/90" 
                    onClick={handleUpdateViewAllDealsPermissions}
                  >
                    Salvar Permissões de Todas as Oportunidades
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="automations" className="p-6 m-0">
              {columnId ? (
                <ColumnAutomationsTab 
                  columnId={columnId} 
                  onAutomationChange={onUpdate}
                  isActive={activeTab === 'automations'}
                  isModalOpen={open}
                  isDarkMode={isDarkMode}
                />
              ) : (
                <div className={`text-center py-8 text-muted-foreground dark:text-gray-400 text-xs`}>
                  Selecione uma etapa para gerenciar automações
                </div>
              )}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>


      <DeletarColunaModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
        columnName={name}
        isDarkMode={isDarkMode}
      />
    </>
  );
}
