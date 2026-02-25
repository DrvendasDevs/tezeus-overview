import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, X, Video } from 'lucide-react';

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  fileName?: string;
}

export const VideoModal: React.FC<VideoModalProps> = ({
  isOpen,
  onClose,
  videoUrl,
  fileName
}) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = videoUrl;
    link.download = fileName || 'video';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full p-0 gap-0 border-gray-300 bg-white rounded-none shadow-lg [&>button]:hidden">
        <div className="flex flex-row items-center justify-between px-4 py-2 bg-[#f8f9fa] border-b border-gray-300">
           <div className="flex items-center gap-2">
            <Video className="h-4 w-4 text-blue-600" />
            <DialogTitle className="text-sm font-semibold text-gray-800 truncate max-w-[300px] p-0">
              {fileName || 'Visualização de Vídeo'}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="h-7 w-7 rounded-none hover:bg-gray-200 text-gray-600"
              title="Baixar"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-7 w-7 rounded-none hover:bg-red-100 hover:text-red-600 text-gray-500"
              title="Fechar"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="p-4 bg-[#e6e6e6] flex items-center justify-center min-h-[300px] max-h-[80vh]">
          <video
            src={videoUrl}
            controls
            autoPlay
            className="max-w-full max-h-full border border-gray-300 bg-black shadow-sm"
            style={{ maxHeight: 'calc(80vh - 60px)' }}
          >
            Seu navegador não suporta o elemento de vídeo.
          </video>
        </div>
      </DialogContent>
    </Dialog>
  );
};
