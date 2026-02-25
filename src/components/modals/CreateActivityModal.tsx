import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Upload, X, Clock } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { logCreate } from "@/utils/auditLog";

interface User {
  id: string;
  name: string;
}

interface Activity {
  id: string;
  type: string;
  subject: string;
  scheduled_for: string;
  responsible_id: string;
}

interface CreateActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  contactId: string;
  onActivityCreated: (activity: Activity) => void;
  isDarkMode?: boolean;
  pipelineCardId?: string; // ID do negócio para vincular a atividade
}

export function CreateActivityModal({ 
  isOpen, 
  onClose, 
  contactId, 
  onActivityCreated, 
  isDarkMode = false,
  pipelineCardId 
}: CreateActivityModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    type: "Lembrete",
    responsibleId: "",
    subject: "",
    description: "",
    durationMinutes: 30,
  });
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState("13:00");
  const [users, setUsers] = useState<User[]>([]);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      // Definir data padrão para hoje
      setSelectedDate(new Date());
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && user?.id) {
      setFormData((prev) => prev.responsibleId ? prev : { ...prev, responsibleId: user.id });
    }
  }, [isOpen, user?.id]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('system_users')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    }
  };

  const handleTimeClick = () => {
    setShowTimePicker(!showTimePicker);
  };

  const handleTimeSelect = (hour: number, minute: number) => {
    const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    setSelectedTime(timeString);
    setShowTimePicker(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAttachedFile(file);
    }
  };

  const removeFile = () => {
    setAttachedFile(null);
  };

  const handleCreateActivity = async () => {
    // Validação diferente para comentários
    if (formData.type === "Comentários") {
      if (!formData.responsibleId || !formData.description.trim()) {
        toast({
          title: "Campos obrigatórios",
          description: "Preencha o responsável e o comentário.",
          variant: "destructive",
        });
        return;
      }
    } else {
      if (!selectedDate || !formData.responsibleId) {
        toast({
          title: "Campos obrigatórios",
          description: "Preencha o responsável e a data.",
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);
    try {
      // Get workspace_id from the contact
      const { data: contactData } = await supabase
        .from('contacts')
        .select('workspace_id')
        .eq('id', contactId)
        .single();

      if (!contactData?.workspace_id) {
        throw new Error('Workspace não encontrado para este contato');
      }

      // Se for comentário, salvar em contact_observations
      if (formData.type === "Comentários") {
        const { error } = await supabase
          .from('contact_observations')
          .insert({
            contact_id: contactId,
            workspace_id: contactData.workspace_id,
            content: formData.description.trim(),
            created_by: formData.responsibleId
          });

        if (error) throw error;

        toast({
          title: "Comentário adicionado com sucesso!",
          description: "O comentário foi salvo no perfil do contato.",
        });

        // Resetar formulário
        setFormData({
          type: "Lembrete",
          responsibleId: "",
          subject: "",
          description: "",
          durationMinutes: 30,
        });
        onClose();
        return;
      }

      // Lógica normal para atividades
      const [hour, minute] = selectedTime.split(':').map(Number);
      const scheduledDateTime = new Date(selectedDate);
      scheduledDateTime.setHours(hour, minute, 0, 0);

      const activityData: any = {
        contact_id: contactId,
        workspace_id: contactData.workspace_id,
        type: formData.type,
        responsible_id: formData.responsibleId,
        subject: formData.subject.trim() || formData.type,
        description: formData.description || null,
        scheduled_for: scheduledDateTime.toISOString(),
        duration_minutes: formData.durationMinutes,
        attachment_name: attachedFile?.name || null,
        attachment_url: null, // Implementar upload de arquivo se necessário
      };

      // Apenas adicionar pipeline_card_id se ele existir
      if (pipelineCardId) {
        activityData.pipeline_card_id = pipelineCardId;
      }

      const { data: activity, error } = await supabase
        .from('activities')
        .insert(activityData)
        .select(`
          id,
          type,
          subject,
          scheduled_for,
          responsible_id
        `)
        .single();

      if (error) throw error;

      // Registrar auditoria da criação
      await logCreate(
        'activity',
        activity.id,
        activity.subject || formData.type,
        {
          type: formData.type,
          subject: activity.subject,
          description: formData.description,
          scheduled_for: activity.scheduled_for,
          responsible_id: formData.responsibleId,
        },
        contactData.workspace_id
      );

      onActivityCreated(activity);
      
      // Verificar se evento foi criado no Google Calendar (opcional, não bloqueia)
      if (formData.responsibleId) {
        // A integração com Google Calendar é assíncrona via trigger
        toast({
          title: "Atividade criada com sucesso!",
          description: `A atividade "${formData.subject}" foi agendada.`,
        });
      } else {
        toast({
          title: "Atividade criada com sucesso!",
          description: `A atividade "${formData.subject}" foi agendada.`,
        });
      }

      // Resetar formulário
      setFormData({
        type: "Lembrete",
        responsibleId: "",
        subject: "",
        description: "",
        durationMinutes: 30,
      });
      setSelectedDate(new Date());
      setSelectedTime("13:00");
      setAttachedFile(null);
      onClose();
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível criar a atividade.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const timeOptions = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      timeOptions.push({
        hour,
        minute,
        display: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      });
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "max-w-2xl max-h-[90vh] overflow-y-auto",
        isDarkMode ? "bg-[#2d2d2d] border-gray-600" : "bg-white"
      )}>
        <DialogHeader>
          <DialogTitle className={cn(
            "text-xl font-semibold",
            isDarkMode ? "text-white" : "text-gray-900"
          )}>
            {formData.type === "Comentários" ? "Adicionar Observação" : "Criar Atividade"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tipo */}
          <div className="space-y-2">
            <label className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-gray-300" : "text-gray-700"
            )}>
              Tipo *
            </label>
            <Select 
              value={formData.type} 
              onValueChange={(value) => setFormData({...formData, type: value})}
            >
              <SelectTrigger className={cn(
                isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white"
              )}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Lembrete">Lembrete</SelectItem>
                <SelectItem value="Mensagem">Mensagem</SelectItem>
                <SelectItem value="Ligação">Ligação</SelectItem>
                <SelectItem value="Ligação Agendada">Ligação Agendada</SelectItem>
                <SelectItem value="Reunião">Reunião</SelectItem>
                <SelectItem value="Agendamento">Agendamento</SelectItem>
                <SelectItem value="Comentários">Observações</SelectItem>
                <SelectItem value="Proposta enviada">Proposta enviada</SelectItem>
                <SelectItem value="Venda realizada">Venda realizada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Responsável */}
          <div className="space-y-2">
            <label className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-gray-300" : "text-gray-700"
            )}>
              Responsável *
            </label>
            <Select 
              value={formData.responsibleId} 
              onValueChange={(value) => setFormData({...formData, responsibleId: value})}
            >
              <SelectTrigger className={cn(
                isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white"
              )}>
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assunto - não mostrar para comentários */}
          {formData.type !== "Comentários" && (
            <div className="space-y-2">
              <label className={cn(
                "text-sm font-medium",
                isDarkMode ? "text-gray-300" : "text-gray-700"
              )}>
                Assunto *
              </label>
              <Input
                placeholder={formData.type}
                value={formData.subject}
                onChange={(e) => setFormData({...formData, subject: e.target.value})}
                className={cn(
                  isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white"
                )}
              />
            </div>
          )}

          {/* Data e Hora - não mostrar para comentários */}
          {formData.type !== "Comentários" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className={cn(
                  "text-sm font-medium",
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Agendar para *
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground",
                        isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? (
                        format(selectedDate, "dd/MM/yyyy", { locale: ptBR })
                      ) : (
                        <span>Selecione a data</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className={cn(
                  "text-sm font-medium",
                  isDarkMode ? "text-gray-300" : "text-gray-700"
                )}>
                  Hora
                </label>
                <Popover open={showTimePicker} onOpenChange={setShowTimePicker}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white"
                      )}
                      onClick={handleTimeClick}
                    >
                      <Clock className="mr-2 h-4 w-4" />
                      {selectedTime}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="max-h-60 overflow-y-auto p-2">
                      {timeOptions.map((time) => (
                        <Button
                          key={time.display}
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => handleTimeSelect(time.hour, time.minute)}
                        >
                          {time.display}
                        </Button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}

          {/* Duração - não mostrar para comentários */}
          {formData.type !== "Comentários" && (
            <div className="space-y-2">
              <label className={cn(
                "text-sm font-medium",
                isDarkMode ? "text-gray-300" : "text-gray-700"
              )}>
                Duração (minutos)
              </label>
              <Input
                type="number"
                value={formData.durationMinutes}
                onChange={(e) => setFormData({...formData, durationMinutes: Number(e.target.value)})}
                className={cn(
                  isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white"
                )}
              />
            </div>
          )}

          {/* Anexo - não mostrar para comentários */}
          {formData.type !== "Comentários" && (
            <div className="space-y-2">
              <label className={cn(
                "text-sm font-medium",
                isDarkMode ? "text-gray-300" : "text-gray-700"
              )}>
                Anexo
              </label>
              <div className={cn(
                "border-2 border-dashed rounded-md p-4",
                isDarkMode ? "border-gray-600" : "border-gray-300"
              )}>
                {attachedFile ? (
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-sm",
                      isDarkMode ? "text-gray-300" : "text-gray-700"
                    )}>
                      {attachedFile.name}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={removeFile}
                      className="h-6 w-6 p-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      onChange={handleFileUpload}
                      className="hidden"
                      accept="*/*"
                    />
                    <div className="flex items-center justify-center space-x-2">
                      <Upload className="w-4 h-4" />
                      <span className={cn(
                        "text-sm",
                        isDarkMode ? "text-gray-400" : "text-gray-600"
                      )}>
                        Clique aqui ou arraste o documento a ser salvo
                      </span>
                    </div>
                  </label>
                )}
              </div>
            </div>
          )}

          {/* Descrição - obrigatória para comentários */}
          <div className="space-y-2">
            <label className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-gray-300" : "text-gray-700"
            )}>
              {formData.type === "Comentários" ? "Observação *" : "Descrição"}
            </label>
            <Textarea
              placeholder={formData.type === "Comentários" ? "Digite a observação..." : "Detalhes adicionais da atividade"}
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className={cn(
                "min-h-[100px]",
                isDarkMode ? "bg-[#2d2d2d] border-gray-600 text-white" : "bg-white"
              )}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className={cn(
                isDarkMode ? "border-gray-600 text-gray-300" : ""
              )}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCreateActivity}
              disabled={isLoading}
              className="bg-yellow-400 text-black hover:bg-yellow-500"
            >
              {isLoading ? (formData.type === "Comentários" ? "Salvando..." : "Criando...") : (formData.type === "Comentários" ? "Salvar Observação" : "Criar Atividade")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}