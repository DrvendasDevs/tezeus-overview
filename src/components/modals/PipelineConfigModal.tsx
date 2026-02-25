import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PipelineConfiguracao from "@/components/modules/PipelineConfiguracao";

interface PipelineConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onColumnsReorder?: (newOrder: any) => void;
  isDarkMode?: boolean;
}

export const PipelineConfigModal: React.FC<PipelineConfigModalProps> = ({
  open,
  onOpenChange,
  onColumnsReorder,
  isDarkMode = false,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-w-6xl max-h-[90vh] overflow-y-auto border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0f0f0f] ${isDarkMode ? 'dark' : ''}`}>
        <DialogHeader>
          <DialogTitle className={`text-gray-900 dark:text-gray-100`}>Configurações do Pipeline</DialogTitle>
        </DialogHeader>
        <PipelineConfiguracao onColumnsReorder={onColumnsReorder} isDarkMode={isDarkMode} />
      </DialogContent>
    </Dialog>
  );
};