import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink } from 'lucide-react';

interface PdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  pdfUrl: string;
  fileName?: string;
}

export const PdfModal: React.FC<PdfModalProps> = ({
  isOpen,
  onClose,
  pdfUrl,
  fileName
}) => {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = fileName || 'documento.pdf';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    window.open(pdfUrl, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-full h-[90vh] flex flex-col p-0 gap-0 border border-[#d4d4d4] bg-white shadow-sm rounded-none">
        <DialogHeader className="flex-shrink-0 bg-primary text-primary-foreground p-3 m-0 rounded-none border-b border-[#d4d4d4]">
          <div className="flex items-center justify-between">
            <DialogTitle className="truncate text-sm font-bold text-primary-foreground">
              {fileName || 'Documento PDF'}
            </DialogTitle>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleOpenInNewTab}
                className="h-7 text-xs rounded-none bg-white/10 text-primary-foreground hover:bg-white/20 border-none"
              >
                <ExternalLink className="h-3.5 w-3.5 mr-2" />
                Abrir em nova aba
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleDownload}
                className="h-7 text-xs rounded-none bg-white/10 text-primary-foreground hover:bg-white/20 border-none"
              >
                <Download className="h-3.5 w-3.5 mr-2" />
                Baixar
              </Button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 flex items-center justify-center bg-gray-100 overflow-hidden">
          <iframe
            src={pdfUrl}
            title={fileName || 'PDF Viewer'}
            className="w-full h-full border-0"
            style={{ minHeight: '500px' }}
            onError={(e) => {
              console.error('PDF iframe error:', e);
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};