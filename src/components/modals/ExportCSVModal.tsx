import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface ExportField {
  key: string;
  label: string;
  available: boolean;
}

interface ExportSection {
  title: string;
  key: string;
  fields: ExportField[];
}

interface ExportCSVModalProps {
  isOpen: boolean;
  onClose: () => void;
  columnName: string;
  cards: any[];
}

export function ExportCSVModal({ isOpen, onClose, columnName, cards }: ExportCSVModalProps) {
  const { toast } = useToast();
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set());

  const contactExtraInfoKeys = useMemo(() => {
    const keys = new Set<string>();

    const collectKeysFromSource = (source: any) => {
      if (!source) return;
      if (Array.isArray(source)) {
        source.forEach((item) => {
          const key = item?.field_name || item?.key;
          if (key) keys.add(key);
        });
        return;
      }
      if (typeof source === "object") {
        Object.keys(source).forEach((key) => {
          if (key) keys.add(key);
        });
      }
    };

    cards.forEach((card) => {
      collectKeysFromSource(card?.contact?.extra_info);
      collectKeysFromSource(card?.contact?.additional_info);
      collectKeysFromSource(card?.contact?.custom_fields);
    });

    return Array.from(keys).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [cards]);

  const extraInfoFields: ExportField[] = useMemo(
    () =>
      contactExtraInfoKeys.map((key) => ({
        key: `contact_extra__${key}`,
        label: key,
        available: true,
      })),
    [contactExtraInfoKeys],
  );

  const sections: ExportSection[] = useMemo(() => {
    const baseSections: ExportSection[] = [
      {
        title: "Informações Básicas",
        key: "basic",
        fields: [
          { key: "id", label: "ID do Negócio", available: true },
          { key: "pipeline", label: "Pipeline", available: cards.some((c) => c.pipeline_id) },
          { key: "value", label: "Preço", available: true },
          { key: "status", label: "Status", available: true },
          { key: "created_at", label: "Data de Criação do Negócio", available: true },
          { key: "updated_at", label: "Última Atualização", available: true },
          { key: "moved_at", label: "Última Movimentação", available: cards.some((c) => c.moved_at) },
          { key: "won_at", label: "Data de Ganho", available: cards.some((c) => c.won_at) },
        ],
      },
      {
        title: "Informações do Contato",
        key: "contact",
        fields: [
          { key: "contact_name", label: "Nome do Contato", available: true },
          { key: "contact_phone", label: "Telefone do Contato", available: true },
          { key: "contact_email", label: "E-mail do Contato", available: true },
        ],
      },
      {
        title: "Informações Comerciais",
        key: "commercial",
        fields: [
          { key: "product", label: "Produtos", available: cards.some((c) => c.product_id) },
          { key: "sales_stage", label: "Coluna Pipeline", available: true },
          {
            key: "tags",
            label: "Tags",
            available: cards.some(
              (c) =>
                (Array.isArray(c.tags) && c.tags.length > 0) ||
                (Array.isArray(c.contact?.contact_tags) && c.contact?.contact_tags?.length > 0),
            ),
          },
          { key: "queue", label: "Filas", available: cards.some((c) => c.conversation?.queue) },
        ],
      },
      {
        title: "Responsáveis",
        key: "responsible",
        fields: [
          { key: "responsible_user", label: "Usuário Responsável", available: true },
        ],
      },
      {
        title: "Atividades",
        key: "activities",
        fields: [
          { key: "activities_count", label: "Total de Atividades", available: cards.some((c) => c.activities?.length > 0) },
          { key: "pending_activities", label: "Atividades Pendentes", available: cards.some((c) => c.activities?.length > 0) },
          { key: "completed_activities", label: "Atividades Concluídas", available: cards.some((c) => c.activities?.length > 0) },
          { key: "next_activity", label: "Próxima Atividade", available: cards.some((c) => c.activities?.length > 0) },
        ],
      },
    ];

    if (extraInfoFields.length > 0) {
      baseSections.push({
        title: "Informações Adicionais do Contato",
        key: "contact_extra",
        fields: extraInfoFields,
      });
    }

    return baseSections;
  }, [cards, extraInfoFields]);

  // Inicializar com todos os campos disponíveis selecionados
  useEffect(() => {
    if (isOpen) {
      const availableFields = sections.flatMap((section) =>
        section.fields.filter((f) => f.available).map((f) => f.key),
      );
      setSelectedFields(new Set(availableFields));
    }
  }, [isOpen, sections]);

  const toggleField = (fieldKey: string) => {
    setSelectedFields(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fieldKey)) {
        newSet.delete(fieldKey);
      } else {
        newSet.add(fieldKey);
      }
      return newSet;
    });
  };

  const selectAllInSection = (section: ExportSection) => {
    const availableKeys = section.fields.filter(f => f.available).map(f => f.key);
    setSelectedFields(prev => {
      const newSet = new Set(prev);
      availableKeys.forEach(key => newSet.add(key));
      return newSet;
    });
  };

  const deselectAllInSection = (section: ExportSection) => {
    const availableKeys = section.fields.filter(f => f.available).map(f => f.key);
    setSelectedFields(prev => {
      const newSet = new Set(prev);
      availableKeys.forEach(key => newSet.delete(key));
      return newSet;
    });
  };

  const selectAll = () => {
    const allAvailable = sections.flatMap(s => 
      s.fields.filter(f => f.available).map(f => f.key)
    );
    setSelectedFields(new Set(allAvailable));
  };

  const isSectionFullySelected = (section: ExportSection) => {
    const availableKeys = section.fields.filter(f => f.available).map(f => f.key);
    return availableKeys.every(key => selectedFields.has(key));
  };

  const getFieldValue = (card: any, fieldKey: string): string => {
    switch (fieldKey) {
      case "id":
        return card.id || "";
      case "pipeline":
        // Buscar nome do pipeline via pipeline_id se disponível
        return card.pipeline?.name || columnName.split(" - ")[0] || "";
      case "value":
        return card.value ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(card.value) : "R$ 0,00";
      case "status":
        return card.status || "";
      case "created_at":
        return card.created_at ? format(new Date(card.created_at), "dd/MM/yyyy HH:mm") : "";
      case "updated_at":
        return card.updated_at ? format(new Date(card.updated_at), "dd/MM/yyyy HH:mm") : "";
      case "moved_at":
        return card.moved_at ? format(new Date(card.moved_at), "dd/MM/yyyy HH:mm") : "";
      case "won_at":
        return card.won_at ? format(new Date(card.won_at), "dd/MM/yyyy HH:mm") : "";
      case "contact_name":
        return card.contact?.name || "";
      case "contact_phone":
        return card.contact?.phone || "";
      case "contact_email":
        return card.contact?.email || "";
      case "product":
        return card.product?.name || card.product_name || "";
      case "product_value":
        return card.product?.value || card.product_value ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(card.product?.value || card.product_value) : "R$ 0,00";
      case "sales_stage":
        return columnName;
      case "tags": {
        const contactTags = Array.isArray(card.contact?.contact_tags)
          ? card.contact.contact_tags.map((ct: any) => ct?.tags?.name).filter(Boolean)
          : [];
        const dealTags = Array.isArray(card.tags)
          ? card.tags
              .map((tag: any) => {
                if (!tag) return null;
                if (typeof tag === "string") return tag;
                if (typeof tag === "object") {
                  if (tag?.name) return tag.name;
                  if (tag?.label) return tag.label;
                  if (tag?.tag?.name) return tag.tag.name;
                  if (tag?.tags?.name) return tag.tags.name;
                }
                return null;
              })
              .filter(Boolean)
          : [];
        const uniqueTags = Array.from(new Set([...contactTags, ...dealTags]));
        return uniqueTags.join(", ");
      }
      case "queue":
        return card.conversation?.queue?.name || "";
      case "responsible_user":
        return card.responsible_user?.name || card.responsible || "";
      case "activities_count":
        return card.activities?.length?.toString() || "0";
      case "pending_activities":
        return card.activities?.filter((a: any) => !a.is_completed)?.length?.toString() || "0";
      case "completed_activities":
        return card.activities?.filter((a: any) => a.is_completed)?.length?.toString() || "0";
      case "next_activity":
        const nextActivity = card.activities
          ?.filter((a: any) => !a.is_completed && a.scheduled_for)
          ?.sort((a: any, b: any) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime())[0];
        return nextActivity ? `${nextActivity.subject} - ${format(new Date(nextActivity.scheduled_for), "dd/MM/yyyy HH:mm")}` : "";
      default: {
        if (fieldKey.startsWith("contact_extra__")) {
          const extraKey = fieldKey.replace("contact_extra__", "");

          const extractValue = (source: any): string => {
            if (!source) return "";
            if (Array.isArray(source)) {
              const match = source.find(
                (entry) => entry?.field_name === extraKey || entry?.key === extraKey,
              );
              const value = match?.field_value ?? match?.value;
              if (value === null || value === undefined) return "";
              if (typeof value === "object") {
                try {
                  return JSON.stringify(value);
                } catch {
                  return "";
                }
              }
              return String(value);
            }
            if (typeof source === "object") {
              const value = source[extraKey];
              if (value === null || value === undefined) return "";
              if (typeof value === "object") {
                try {
                  return JSON.stringify(value);
                } catch {
                  return "";
                }
              }
              return String(value);
            }
            return "";
          };

          const sources = [
            card.contact?.extra_info,
            card.contact?.additional_info,
            card.contact?.custom_fields,
          ];

          for (const source of sources) {
            const extracted = extractValue(source);
            if (extracted) {
              return extracted;
            }
          }

          return "";
        }
        return "";
      }
    }
  };

  const handleExport = () => {
    if (selectedFields.size === 0) {
      toast({
        title: "Nenhum campo selecionado",
        description: "Selecione ao menos um campo para exportar.",
        variant: "destructive",
      });
      return;
    }

    // Criar headers baseado nos campos selecionados
    // Se "product" estiver selecionado, incluir automaticamente "product_value" como coluna adicional
    const selectedFieldsArray = Array.from(selectedFields);
    const finalFields: string[] = [];
    
    selectedFieldsArray.forEach(key => {
      finalFields.push(key);
      // Se for produto, adicionar valor do produto logo após
      if (key === "product") {
        finalFields.push("product_value");
      }
    });
    
    const headers = finalFields.map(key => {
      for (const section of sections) {
        const field = section.fields.find(f => f.key === key);
        if (field) return field.label;
      }
      return key;
    });

    // Criar linhas de dados
    const rows = cards.map(card => {
      return finalFields.map(key => {
        let value = getFieldValue(card, key);
        // Remover quebras de linha e caracteres de controle
        value = value.replace(/[\r\n\t]+/g, " ").trim();
        // Escapar aspas duplas duplicando-as
        value = value.replace(/"/g, '""');
        // Sempre envolver em aspas para segurança
        return `"${value}"`;
      });
    });

    // BOM para UTF-8 (para Excel reconhecer acentuação)
    const BOM = "\uFEFF";
    const csvContent = BOM + [
      headers.map(h => `"${h.replace(/"/g, '""')}"`).join(","),
      ...rows.map(row => row.join(","))
    ].join("\n");

    // Download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `pipeline-${columnName}-${format(new Date(), "yyyyMMdd-HHmmss")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Exportação concluída",
      description: `${cards.length} negócios exportados com ${selectedFields.size} campos.`,
    });

    onClose();
  };

  const selectedCount = selectedFields.size;
  const totalAvailable = sections.flatMap(s => s.fields.filter(f => f.available)).length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold">
            Selecionar Campos para Exportação CSV
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Etapa: {columnName}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              className="text-yellow-600 border-yellow-600 hover:bg-yellow-50"
            >
              Selecionar Todos
            </Button>
            <p className="text-sm text-muted-foreground">
              {selectedCount} de {totalAvailable} campos selecionados
            </p>
          </div>

          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-6">
              {sections.map(section => {
                const availableFields = section.fields.filter(f => f.available);
                if (availableFields.length === 0) return null;

                const isFullySelected = isSectionFullySelected(section);

                return (
                  <div key={section.key} className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-yellow-600">
                        {section.title}
                      </h3>
                      <button
                        onClick={() => isFullySelected ? deselectAllInSection(section) : selectAllInSection(section)}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {isFullySelected ? "Desmarcar Seção" : "Selecionar Seção"}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {availableFields.map(field => (
                        <div key={field.key} className="flex items-center space-x-2">
                          <Checkbox
                            id={field.key}
                            checked={selectedFields.has(field.key)}
                            onCheckedChange={() => toggleField(field.key)}
                          />
                          <label
                            htmlFor={field.key}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {field.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            disabled={selectedFields.size === 0}
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            Exportar CSV ({selectedCount} campos)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
