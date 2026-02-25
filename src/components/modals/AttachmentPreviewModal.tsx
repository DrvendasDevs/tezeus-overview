import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, FileText } from "lucide-react";
import { useMemo } from "react";

interface AttachmentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  attachment: {
    url: string;
    name: string;
    type?: string;
  } | null;
}

export function AttachmentPreviewModal({
  isOpen,
  onClose,
  attachment,
}: AttachmentPreviewModalProps) {
  const normalizedType = useMemo(() => {
    if (!attachment?.type) return "file";
    const type = attachment.type.toLowerCase();
    if (type.startsWith("image") || ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(type)) {
      return "image";
    }
    if (type.includes("pdf") || type === "pdf") {
      return "pdf";
    }
    if (["xls", "xlsx", "csv", "sheet"].includes(type)) {
      return "sheet";
    }
    return type;
  }, [attachment?.type]);

  const viewerUrl = useMemo(() => {
    if (!attachment?.url) return null;

    if (normalizedType === "sheet") {
      return `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(attachment.url)}`;
    }

    if (normalizedType === "pdf") {
      return `${attachment.url}#toolbar=0`;
    }

    return attachment.url;
  }, [attachment?.url, normalizedType]);

  const handleDownload = () => {
    if (!attachment?.url) return;
    const link = document.createElement("a");
    link.href = attachment.url;
    link.download = attachment.name || "arquivo";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderContent = () => {
    if (!attachment) return null;

    if (normalizedType === "image") {
      return (
        <img
          src={attachment.url}
          alt={attachment.name || "Imagem"}
          className="max-w-full max-h-full object-contain"
        />
      );
    }

    if (normalizedType === "pdf" || normalizedType === "sheet") {
      return (
        <iframe
          src={viewerUrl || attachment.url}
          title={attachment.name || "Pré-visualização do documento"}
          className="w-[90vw] h-[80vh] rounded-md bg-background"
          allowFullScreen
        />
      );
    }

    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
        <FileText className="h-16 w-16 text-muted-foreground" />
        <div className="space-y-2">
          <p className="text-base font-medium text-foreground">
            {attachment.name || "Arquivo anexado"}
          </p>
          <p className="text-sm text-muted-foreground">
            Pré-visualização não disponível. Faça o download para visualizar o conteúdo.
          </p>
        </div>
      </div>
    );
  };

  if (!attachment) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogOverlay className="bg-black/90" />
      <DialogContent className="max-w-[95vw] max-h-[95vh] border-0 bg-transparent p-0 shadow-none">
        <div className="relative flex flex-col items-center justify-center h-full">
          {renderContent()}

          <div className="absolute top-4 right-4 flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={onClose}
              className="rounded-full bg-background/80 text-foreground hover:bg-background/90"
            >
              <X className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleDownload}
              className="rounded-full bg-background/80 text-foreground hover:bg-background/90"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

