import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { X, Download, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  fileName?: string;
}

export const ImageModal: React.FC<ImageModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  fileName,
}) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = fileName || 'image';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full p-0 gap-0 border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0f0f0f] rounded-none shadow-lg [&>button]:hidden">
        <div className="flex flex-row items-center justify-between px-4 py-2 bg-[#f8f9fa] dark:bg-[#1a1a1a] border-b border-gray-300 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <DialogTitle className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[300px] p-0">
              {fileName || 'Visualização de Imagem'}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-7 w-7 rounded-none hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
              title="Baixar"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 rounded-none hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 text-gray-500 dark:text-gray-400"
              title="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="p-4 bg-[#e6e6e6] dark:bg-[#0a0a0a] flex items-center justify-center min-h-[300px] max-h-[80vh]">
          <img
            src={imageUrl}
            alt={fileName || 'Imagem'}
            className="max-w-full max-h-full object-contain border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] shadow-sm"
            onError={(e) => {
              console.error('Erro ao carregar imagem no modal:', imageUrl);
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
