import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useWorkspace } from '@/contexts/WorkspaceContext';

interface ChatMessage {
  id: string;
  content: string;
  sender_type: 'contact' | 'agent' | 'ia' | 'system' | 'user';
  created_at: string;
  origem_resposta: 'automatica' | 'manual';
}

interface ChatWidgetProps {
  customerName?: string;
  customerEmail?: string;
  className?: string;
}

export const ChatWidget = ({ 
  customerName = 'Visitante', 
  customerEmail,
  className = '' 
}: ChatWidgetProps) => {
  const { selectedWorkspace } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll para última mensagem
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Inicializar conversa quando widget é aberto
  const initializeConversation = async () => {
    try {
      setIsLoading(true);
      
      // Criar ou encontrar contato
      let contact;
      if (customerEmail) {
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('*')
          .eq('email', customerEmail)
          .single();

        if (existingContact) {
          contact = existingContact;
        } else {
          if (!selectedWorkspace) {
            toast({
              title: "Erro",
              description: "Nenhuma empresa selecionada",
              variant: "destructive"
            });
            return;
          }

          const { data: newContact, error: contactError } = await supabase
            .from('contacts')
            .insert({
              name: customerName,
              email: customerEmail,
              workspace_id: selectedWorkspace!.workspace_id
            })
            .select()
            .single();

          if (contactError) throw contactError;
          contact = newContact;
        }
      } else {
        if (!selectedWorkspace) {
          toast({
            title: "Erro",
            description: "Nenhuma empresa selecionada",
            variant: "destructive"
          });
          return;
        }

        // Criar contato temporário para visitante anônimo
        const { data: newContact, error: contactError } = await supabase
          .from('contacts')
          .insert({
            name: `${customerName} ${Date.now()}`,
            email: `temp_${Date.now()}@temp.com`,
            workspace_id: selectedWorkspace!.workspace_id
          })
          .select()
          .single();

        if (contactError) throw contactError;
        contact = newContact;
      }

      setContactId(contact.id);

      // Buscar conversa ativa existente ou criar nova
      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('*')
        .eq('contact_id', contact.id)
        .eq('canal', 'site')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      let conversation;
      if (existingConversation) {
        conversation = existingConversation;
      } else {
        const { data: newConversation, error: convError } = await supabase
          .from('conversations')
          .insert({
            contact_id: contact.id,
            canal: 'site',
            agente_ativo: true,
            status: 'open',
            workspace_id: selectedWorkspace!.workspace_id
          })
          .select()
          .single();

        if (convError) throw convError;
        conversation = newConversation;
      }

      setConversationId(conversation.id);

      // Carregar mensagens existentes
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      setMessages(messagesData.map(msg => ({
        id: msg.id,
        content: msg.content,
        sender_type: msg.sender_type as ChatMessage['sender_type'],
        created_at: msg.created_at,
        origem_resposta: (msg.origem_resposta || 'manual') as 'automatica' | 'manual'
      })));

      // Enviar mensagem de boas-vindas se for nova conversa
      if (!existingConversation) {
        const userData = localStorage.getItem('currentUser');
        const currentUserData = userData ? JSON.parse(userData) : null;
        
        const headers: Record<string, string> = {};
        if (currentUserData?.id) {
          headers['x-system-user-id'] = currentUserData.id;
          headers['x-system-user-email'] = currentUserData.email || '';
        }
        if (selectedWorkspace?.workspace_id) {
          headers['x-workspace-id'] = selectedWorkspace.workspace_id;
        }

        await supabase.functions.invoke('ai-chat-response', {
          body: {
            messageId: null,
            conversationId: conversation.id,
            content: 'Olá! Como posso ajudar você hoje?'
          },
          headers
        });
      }

    } catch (error) {
      console.error('Erro ao inicializar conversa:', error);
      toast({
        title: "Erro",
        description: "Erro ao inicializar chat",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Enviar mensagem
  const handleSendMessage = async () => {
    if (!messageText.trim() || !conversationId || !contactId) return;

    try {
      setIsLoading(true);
      const content = messageText.trim();
      setMessageText('');

      // Inserir mensagem do cliente
      const { data: newMessage, error: insertError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          content,
          sender_type: 'contact',
          message_type: 'text',
          status: 'sent',
          origem_resposta: 'manual',
          workspace_id: selectedWorkspace!.workspace_id
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Atualizar estado local
      setMessages(prev => [...prev, {
        id: newMessage.id,
        content,
        sender_type: 'contact',
        created_at: newMessage.created_at,
        origem_resposta: 'manual'
      }]);

      // Acionar resposta da IA with workspace context
      const userData = localStorage.getItem('currentUser');
      const currentUserData = userData ? JSON.parse(userData) : null;
      
      const headers: Record<string, string> = {};
      if (currentUserData?.id) {
        headers['x-system-user-id'] = currentUserData.id;
        headers['x-system-user-email'] = currentUserData.email || '';
      }
      if (selectedWorkspace?.workspace_id) {
        headers['x-workspace-id'] = selectedWorkspace.workspace_id;
      }

      await supabase.functions.invoke('ai-chat-response', {
        body: {
          messageId: newMessage.id,
          conversationId,
          content
        },
        headers
      });

    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar mensagem",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Configurar realtime quando conversa estiver ativa
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`chat-widget-${conversationId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const newMessage = payload.new as any;
          
          // Só adicionar se não for uma mensagem que já enviamos
          setMessages(prev => {
            const exists = prev.some(msg => msg.id === newMessage.id);
            if (exists) return prev;
            
            return [...prev, {
              id: newMessage.id,
              content: newMessage.content,
              sender_type: newMessage.sender_type,
              created_at: newMessage.created_at,
              origem_resposta: newMessage.origem_resposta || 'manual'
            }];
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [conversationId]);

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getMessageIcon = (sender_type: string, origem_resposta: string) => {
    if (sender_type === 'contact') return <User className="w-4 h-4" />;
    if (sender_type === 'ia' || origem_resposta === 'automatica') return <Bot className="w-4 h-4" />;
    return <User className="w-4 h-4" />;
  };

  const getMessageStyle = (sender_type: string, origem_resposta: string) => {
    if (sender_type === 'contact') {
      return 'bg-muted text-left';
    }
    if (sender_type === 'ia' || origem_resposta === 'automatica') {
      return 'bg-blue-500 text-white text-right ml-8';
    }
    return 'bg-green-500 text-white text-right ml-8';
  };

  if (!isOpen) {
    return (
      <div className={`fixed bottom-4 right-4 z-50 ${className}`}>
        <Button
          onClick={() => {
            setIsOpen(true);
            if (!conversationId) {
              initializeConversation();
            }
          }}
          size="lg"
          className="rounded-full w-14 h-14 shadow-lg hover:shadow-xl transition-shadow"
        >
          <MessageCircle className="w-6 h-6" />
        </Button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-4 right-4 z-50 w-80 ${className}`}>
      <Card className="shadow-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Chat de Atendimento</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span className="text-sm text-muted-foreground">Online</span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {/* Área de mensagens */}
          <div className="h-96 overflow-y-auto p-4 space-y-3 bg-muted/20">
            {isLoading && messages.length === 0 && (
              <div className="text-center text-muted-foreground">
                Iniciando conversa...
              </div>
            )}
            
            {messages.map((message) => (
              <div key={message.id} className="space-y-1">
                <div className={`p-3 rounded-lg max-w-[85%] ${
                  message.sender_type === 'contact' 
                    ? 'bg-muted mr-8' 
                    : getMessageStyle(message.sender_type, message.origem_resposta)
                } ${message.sender_type !== 'contact' ? 'ml-auto' : ''}`}>
                  <div className="flex items-start gap-2">
                    {getMessageIcon(message.sender_type, message.origem_resposta)}
                    <div className="flex-1">
                      <p className="text-sm">{message.content}</p>
                    </div>
                  </div>
                </div>
                
                <div className={`flex items-center gap-2 text-xs text-muted-foreground ${
                  message.sender_type !== 'contact' ? 'justify-end' : ''
                }`}>
                  <span>{formatTime(message.created_at)}</span>
                  {message.origem_resposta === 'automatica' && (
                    <Badge variant="secondary" className="text-xs">IA</Badge>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input de mensagem */}
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Digite sua mensagem..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={isLoading}
              />
              <Button
                onClick={handleSendMessage}
                disabled={!messageText.trim() || isLoading}
                size="sm"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};