import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgendamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDarkMode?: boolean;
  contactName?: string;
}

const formatTypes = ["Texto", "Imagem", "Áudio"];
const variables = ["Primeiro Nome", "Nome", "Saudação", "Protocolo", "Hora"];

export function AgendamentoModal({ isOpen, onClose, isDarkMode = false, contactName = "" }: AgendamentoModalProps) {
  const [selectedTab, setSelectedTab] = useState("mensagem");
  const [message, setMessage] = useState("");
  const [formatType, setFormatType] = useState("Texto");
  const [useDSVoice, setUseDSVoice] = useState(false);
  const [dateTime, setDateTime] = useState("");
  const [connection, setConnection] = useState("");
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);

  const handleSubmit = () => {
    // Lógica para criar agendamento
    console.log("Novo agendamento criado");
    onClose();
  };

  const handleVariableClick = (variable: string) => {
    setMessage(prev => prev + `{${variable}}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn(
        "max-w-2xl max-h-[90vh] overflow-y-auto",
        isDarkMode 
          ? "bg-gray-800 border-gray-600 text-white" 
          : "bg-white border-gray-200 text-gray-900"
      )}>
        <DialogHeader>
          <DialogTitle className={cn(
            "text-lg font-semibold",
            isDarkMode ? "text-white" : "text-gray-900"
          )}>
            Novo Agendamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Campo de contato preenchido automaticamente */}
          <div>
            <Label htmlFor="contact" className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-gray-200" : "text-gray-700"
            )}>
              Contato
            </Label>
            <Input
              id="contact"
              value={contactName}
              readOnly
              className={cn(
                "mt-1",
                isDarkMode 
                  ? "bg-gray-700 border-gray-600 text-white" 
                  : "bg-gray-100 border-gray-300 text-gray-900"
              )}
            />
          </div>

          {/* Abas */}
          <Tabs value={selectedTab} onValueChange={setSelectedTab}>
            <TabsList className={cn(
              "grid w-full grid-cols-2",
              isDarkMode ? "bg-gray-700" : "bg-gray-100"
            )}>
              <TabsTrigger value="mensagem" className={cn(
                isDarkMode 
                  ? "data-[state=active]:bg-gray-600 data-[state=active]:text-white" 
                  : "data-[state=active]:bg-white data-[state=active]:text-gray-900"
              )}>
                Mensagem
              </TabsTrigger>
              <TabsTrigger value="evento" className={cn(
                isDarkMode 
                  ? "data-[state=active]:bg-gray-600 data-[state=active]:text-white" 
                  : "data-[state=active]:bg-white data-[state=active]:text-gray-900"
              )}>
                Evento
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mensagem" className="space-y-4">
              {/* Campo de mensagem */}
              <div>
                <Label htmlFor="message" className={cn(
                  "text-sm font-medium",
                  isDarkMode ? "text-gray-200" : "text-gray-700"
                )}>
                  Mensagem
                </Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  rows={4}
                  className={cn(
                    "mt-1",
                    isDarkMode 
                      ? "bg-gray-700 border-gray-600 text-white placeholder:text-gray-400" 
                      : "bg-white border-gray-300 text-gray-900 placeholder:text-gray-500"
                  )}
                />
              </div>

              {/* Opções de formatação */}
              <div>
                <Label className={cn(
                  "text-sm font-medium",
                  isDarkMode ? "text-gray-200" : "text-gray-700"
                )}>
                  Formato
                </Label>
                <Select value={formatType} onValueChange={setFormatType}>
                  <SelectTrigger className={cn(
                    "mt-1",
                    isDarkMode 
                      ? "bg-gray-700 border-gray-600 text-white" 
                      : "bg-white border-gray-300 text-gray-900"
                  )}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className={cn(
                    isDarkMode 
                      ? "bg-gray-700 border-gray-600" 
                      : "bg-white border-gray-300"
                  )}>
                    {formatTypes.map((type) => (
                      <SelectItem key={type} value={type} className={cn(
                        isDarkMode 
                          ? "text-white hover:bg-gray-600" 
                          : "text-gray-900 hover:bg-gray-100"
                      )}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Checkbox DS Voice */}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="dsvoice"
                  checked={useDSVoice}
                  onCheckedChange={(checked) => setUseDSVoice(checked === true)}
                  className={cn(
                    isDarkMode ? "border-gray-600" : "border-gray-300"
                  )}
                />
                <Label htmlFor="dsvoice" className={cn(
                  "text-sm",
                  isDarkMode ? "text-gray-200" : "text-gray-700"
                )}>
                  Usar DS Voice
                </Label>
              </div>

              {/* Variáveis disponíveis */}
              <div>
                <Label className={cn(
                  "text-sm font-medium",
                  isDarkMode ? "text-gray-200" : "text-gray-700"
                )}>
                  Variáveis disponíveis
                </Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {variables.map((variable) => (
                    <Button
                      key={variable}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleVariableClick(variable)}
                      className={cn(
                        "text-xs",
                        isDarkMode 
                          ? "border-gray-600 text-gray-300 hover:bg-gray-700" 
                          : "border-gray-300 text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      {variable}
                    </Button>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="evento" className="space-y-4">
              <div className="text-center py-8">
                <p className={cn(
                  "text-sm",
                  isDarkMode ? "text-gray-400" : "text-gray-500"
                )}>
                  Configurações de evento serão implementadas aqui
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Data e hora */}
          <div>
            <Label htmlFor="datetime" className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-gray-200" : "text-gray-700"
            )}>
              Data e Hora do Agendamento
            </Label>
            <div className="relative mt-1">
              <Input
                id="datetime"
                type="datetime-local"
                value={dateTime}
                onChange={(e) => setDateTime(e.target.value)}
                className={cn(
                  "pr-10",
                  isDarkMode 
                    ? "bg-gray-700 border-gray-600 text-white" 
                    : "bg-white border-gray-300 text-gray-900"
                )}
              />
              <Calendar className={cn(
                "absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4",
                isDarkMode ? "text-gray-400" : "text-gray-500"
              )} />
            </div>
          </div>

          {/* Seleção de conexão */}
          <div>
            <Label className={cn(
              "text-sm font-medium",
              isDarkMode ? "text-gray-200" : "text-gray-700"
            )}>
              Conexão
            </Label>
            <Select value={connection} onValueChange={setConnection}>
              <SelectTrigger className={cn(
                "mt-1",
                isDarkMode 
                  ? "bg-gray-700 border-gray-600 text-white" 
                  : "bg-white border-gray-300 text-gray-900"
              )}>
                <SelectValue placeholder="Selecione uma Conexão" />
              </SelectTrigger>
              <SelectContent className={cn(
                isDarkMode 
                  ? "bg-gray-700 border-gray-600" 
                  : "bg-white border-gray-300"
              )}>
                <SelectItem value="conexao1" className={cn(
                  isDarkMode 
                    ? "text-white hover:bg-gray-600" 
                    : "text-gray-900 hover:bg-gray-100"
                )}>
                  Conexão 1
                </SelectItem>
                <SelectItem value="conexao2" className={cn(
                  isDarkMode 
                    ? "text-white hover:bg-gray-600" 
                    : "text-gray-900 hover:bg-gray-100"
                )}>
                  Conexão 2
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Botões de ação */}
        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={onClose}
            className={cn(
              isDarkMode 
                ? "border-gray-600 text-gray-300 hover:bg-gray-700" 
                : "border-gray-300 text-gray-700 hover:bg-gray-100"
            )}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Adicionar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}