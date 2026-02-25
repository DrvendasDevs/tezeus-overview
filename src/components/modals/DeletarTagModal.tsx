import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { logDelete } from "@/utils/auditLog";

interface Tag {
  id: string;
  name: string;
}

interface DeletarTagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTagDeleted: () => void;
  tag: Tag | null;
}

export function DeletarTagModal({ isOpen, onClose, onTagDeleted, tag }: DeletarTagModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { selectedWorkspace } = useWorkspace();

  const handleDelete = async () => {
    if (!tag?.id) return;

    setIsLoading(true);
    try {
      // Primeiro deletar todos os registros de contact_tags associados
      const { error: contactTagsError } = await supabase
        .from('contact_tags')
        .delete()
        .eq('tag_id', tag.id);

      if (contactTagsError) throw contactTagsError;

      // Depois deletar a tag
      const { error: tagError } = await supabase
        .from('tags')
        .delete()
        .eq('id', tag.id);

      if (tagError) throw tagError;

      // Registrar log de auditoria
      await logDelete(
        'tag',
        tag.id,
        tag.name,
        { name: tag.name },
        selectedWorkspace?.workspace_id
      );

      toast({
        title: "Etiqueta deletada",
        description: `A etiqueta "${tag.name}" foi deletada com sucesso.`,
      });

      onTagDeleted();
      onClose();
    } catch (error: any) {
      console.error('Erro ao deletar etiqueta:', error);
      toast({
        title: "Erro",
        description: "Não foi possível deletar a etiqueta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="max-w-md bg-white text-gray-900 border border-[#d4d4d4] rounded-none shadow-lg dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
        <AlertDialogHeader className="px-4 py-2 bg-primary text-primary-foreground border-b border-[#d4d4d4] rounded-t-none dark:border-gray-700">
          <AlertDialogTitle className="text-lg font-semibold flex items-center gap-2 text-primary-foreground dark:text-gray-100">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            Deletar Etiqueta
          </AlertDialogTitle>
        </AlertDialogHeader>

        <div className="py-4 px-4">
          <AlertDialogDescription className="text-sm text-gray-600 dark:text-gray-300">
            <strong>Atenção!</strong>{" "}
            Tem certeza que deseja deletar a etiqueta{" "}
            <span className="font-semibold text-gray-900 dark:text-gray-100">"{tag?.name}"</span>? Esta ação
            removerá a etiqueta de todos os contatos associados e não poderá ser desfeita.
          </AlertDialogDescription>
        </div>

        <AlertDialogFooter className="mt-0 flex justify-end gap-2 border-t border-[#d4d4d4] pt-4 bg-gray-50 dark:bg-[#050505] dark:border-gray-700">
          <AlertDialogCancel
            disabled={isLoading}
            className="rounded-none border border-[#d4d4d4] text-gray-800 bg-white hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:bg-transparent dark:hover:bg-[#1f1f1f]"
          >
            Cancelar
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isLoading}
            className="rounded-none bg-red-600 hover:bg-red-700 text-white dark:bg-red-700 dark:hover:bg-red-800"
          >
            {isLoading ? "Deletando..." : "OK"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}