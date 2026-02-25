import { Settings } from "lucide-react";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConexoesNova } from "@/components/modules/ConexoesNova";
import { BusinessHoursConfig } from "@/components/modules/BusinessHoursConfig";
import { WorkspaceAutomationsConfig } from "@/components/modules/WorkspaceAutomationsConfig";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getWorkspaceHeaders } from "@/lib/workspaceHeaders";

interface WorkspaceConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workspaceName: string;
}

interface Pipeline {
  id: string;
  name: string;
}

export function WorkspaceConfigModal({
  open,
  onOpenChange,
  workspaceId,
  workspaceName
}: WorkspaceConfigModalProps) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [defaultPipelineId, setDefaultPipelineId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && workspaceId) {
      loadPipelines();
      loadDefaultPipeline();
    }
  }, [open, workspaceId]);

  const loadPipelines = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('pipeline-management/pipelines', {
        method: 'GET',
        headers: getWorkspaceHeaders(workspaceId)
      });

      if (error) throw error;
      setPipelines(data || []);
    } catch (error) {
      console.error('Erro ao carregar pipelines:', error);
    }
  };

  const loadDefaultPipeline = async () => {
    // TODO: Aplicar migração 20251119140252 para adicionar coluna default_pipeline_id
    // Por enquanto, desabilitado para evitar erro 406
    setDefaultPipelineId("none");
  };

  const handleSaveDefaultPipeline = async () => {
    try {
      setIsLoading(true);
      
      const headers = getWorkspaceHeaders(workspaceId);
      
      const { error } = await supabase.functions.invoke('manage-workspaces', {
        body: {
          action: 'update',
          workspaceId,
          name: workspaceName,
          defaultPipelineId: defaultPipelineId === "none" ? null : defaultPipelineId
        },
        headers
      });

      if (error) throw error;

      toast({
        title: "Sucesso",
        description: "Pipeline padrão configurada com sucesso!",
      });
    } catch (error) {
      console.error('Erro ao salvar pipeline padrão:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar pipeline padrão.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-white text-gray-900 dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
        <DialogHeader className="px-4 py-2 bg-primary text-primary-foreground dark:text-white border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700">
          <DialogTitle className="flex items-center gap-2 text-primary-foreground dark:text-white">
            <Settings className="w-5 h-5" />
            Configurações da Empresa: {workspaceName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <Tabs defaultValue="connections" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-[#f3f3f3] dark:bg-[#2d2d2d] rounded-none h-auto p-0 border-b border-[#d4d4d4] dark:border-gray-700">
              <TabsTrigger 
                value="connections"
                className="rounded-none py-3 px-6 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-[#FEF3C7] dark:data-[state=active]:bg-gray-700 data-[state=active]:text-black dark:data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-gray-300 dark:data-[state=active]:border-gray-600 data-[state=active]:shadow-none text-gray-700 dark:text-gray-300"
              >
                Configurações
              </TabsTrigger>
              <TabsTrigger 
                value="business-hours"
                className="rounded-none py-3 px-6 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-[#FEF3C7] dark:data-[state=active]:bg-gray-700 data-[state=active]:text-black dark:data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-gray-300 dark:data-[state=active]:border-gray-600 data-[state=active]:shadow-none text-gray-700 dark:text-gray-300"
              >
                Horários de Funcionamento
              </TabsTrigger>
              <TabsTrigger 
                value="automations"
                className="rounded-none py-3 px-6 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-[#FEF3C7] dark:data-[state=active]:bg-gray-700 data-[state=active]:text-black dark:data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-gray-300 dark:data-[state=active]:border-gray-600 data-[state=active]:shadow-none text-gray-700 dark:text-gray-300"
              >
                Automações
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="connections" className="mt-6">
              <ConexoesNova workspaceId={workspaceId} />
            </TabsContent>
            
            <TabsContent value="business-hours" className="mt-6">
              <BusinessHoursConfig workspaceId={workspaceId} />
            </TabsContent>

            <TabsContent value="automations" className="mt-6">
              <WorkspaceAutomationsConfig workspaceId={workspaceId} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}