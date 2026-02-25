import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Plus, Trash2, ChevronDown, ChevronUp, MessageSquare, Music, Image, FileText } from 'lucide-react';
import { useQuickFunnels, FunnelStep } from '@/hooks/useQuickFunnels';
import { useQuickMessages } from '@/hooks/useQuickMessages';
import { useQuickAudios } from '@/hooks/useQuickAudios';
import { useQuickMedia } from '@/hooks/useQuickMedia';
import { useQuickDocuments } from '@/hooks/useQuickDocuments';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface QuickFunnelsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendFunnel?: (funnel: any) => void;
}

export function QuickFunnelsModal({ 
  open, 
  onOpenChange,
  onSendFunnel
}: QuickFunnelsModalProps) {
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [funnelTitle, setFunnelTitle] = useState('');
  const [steps, setSteps] = useState<FunnelStep[]>([]);
  const [expandedFunnel, setExpandedFunnel] = useState<string | null>(null);
  
  const { funnels, loading, createFunnel, deleteFunnel } = useQuickFunnels();
  const { messages } = useQuickMessages();
  const { audios } = useQuickAudios();
  const { media } = useQuickMedia();
  const { documents } = useQuickDocuments();

  const handleAddStep = () => {
    const newStep: FunnelStep = {
      id: Date.now().toString(),
      type: 'message',
      item_id: '',
      delay_seconds: 0,
      order: steps.length,
    };
    setSteps([...steps, newStep]);
  };

  const handleRemoveStep = (stepId: string) => {
    setSteps(steps.filter(s => s.id !== stepId));
  };

  const handleUpdateStep = (stepId: string, field: keyof FunnelStep, value: any) => {
    setSteps(steps.map(s => s.id === stepId ? { ...s, [field]: value } : s));
  };

  const handleSaveFunnel = async () => {
    if (!funnelTitle.trim() || steps.length === 0) {
      return;
    }

    const validSteps = steps.filter(s => s.item_id);
    if (validSteps.length === 0) {
      return;
    }

    await createFunnel(funnelTitle, validSteps);
    setFunnelTitle('');
    setSteps([]);
    setMode('list');
  };

  const handleSendFunnel = (funnel: any) => {
    if (onSendFunnel) {
      onSendFunnel(funnel);
      onOpenChange(false);
    }
  };

  const getItemDetails = (type: string, itemId: string) => {
    switch (type) {
      case 'message':
        return messages.find(m => m.id === itemId);
      case 'audio':
        return audios.find(a => a.id === itemId);
      case 'media':
        return media.find(m => m.id === itemId);
      case 'document':
        return documents.find(d => d.id === itemId);
      default:
        return null;
    }
  };

  const getItemsByType = (type: string) => {
    switch (type) {
      case 'message':
        return messages;
      case 'audio':
        return audios;
      case 'media':
        return media;
      case 'document':
        return documents;
      default:
        return [];
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="w-4 h-4" />;
      case 'audio':
        return <Music className="w-4 h-4" />;
      case 'media':
        return <Image className="w-4 h-4" />;
      case 'document':
        return <FileText className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl mx-auto bg-white text-gray-900 border border-[#d4d4d4] dark:bg-[#0b0b0b] dark:text-gray-100 dark:border-gray-700">
        <DialogHeader className="border-b border-[#e5e5e5] pb-2 mb-4 dark:border-gray-800">
          <DialogTitle className="text-center text-lg font-semibold text-gray-900 dark:text-gray-100">
            {mode === 'list' ? 'Funis de Mensagens' : 'Novo Funil'}
          </DialogTitle>
        </DialogHeader>

        {mode === 'list' ? (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setMode('create')} size="sm" className="rounded-none dark:bg-primary dark:text-primary-foreground">
                <Plus className="w-4 h-4 mr-2" />
                Criar Funil
              </Button>
            </div>

            <ScrollArea className="h-96">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-sm text-muted-foreground dark:text-gray-400">Carregando...</div>
                </div>
              ) : funnels.length > 0 ? (
                <div className="space-y-2">
                  {funnels.map((funnel) => (
                    <div key={funnel.id} className="border rounded-lg p-3 hover:bg-accent/50 transition-colors bg-white dark:bg-[#111111] dark:border-gray-700 dark:hover:bg-[#1f1f1f]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 flex-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => setExpandedFunnel(expandedFunnel === funnel.id ? null : funnel.id)}
                          >
                            {expandedFunnel === funnel.id ? 
                              <ChevronUp className="w-4 h-4" /> : 
                              <ChevronDown className="w-4 h-4" />
                            }
                          </Button>
                          <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">{funnel.title}</h4>
                          <span className="text-xs text-muted-foreground dark:text-gray-400">
                            ({funnel.steps?.length || 0} etapas)
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSendFunnel(funnel)}
                            className="h-8 w-8 p-0"
                          >
                            <Send className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteFunnel(funnel.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      
                      {expandedFunnel === funnel.id && (
                        <div className="mt-3 space-y-2 pl-8">
                          {funnel.steps?.map((step, index) => {
                            const itemDetails = getItemDetails(step.type, step.item_id);
                            return (
                              <div key={step.id} className="flex items-center gap-2 text-sm">
                                <span className="text-muted-foreground dark:text-gray-400">{index + 1}.</span>
                                <div className="w-6 h-6 bg-muted rounded flex items-center justify-center dark:bg-[#1f1f1f]">
                                  {getTypeIcon(step.type)}
                                </div>
                                <span className="flex-1 text-gray-900 dark:text-gray-100">{itemDetails?.title || 'Item removido'}</span>
                                {step.delay_seconds > 0 && (
                                  <span className="text-xs text-muted-foreground dark:text-gray-400">
                                    {step.delay_seconds}s
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <p className="text-sm text-muted-foreground dark:text-gray-400">
                    Nenhum funil criado ainda
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block text-gray-700 dark:text-gray-200">Nome do Funil</label>
              <Input
                value={funnelTitle}
                onChange={(e) => setFunnelTitle(e.target.value)}
                placeholder="Ex: Boas-vindas VIP"
                className="dark:bg-[#111111] dark:border-gray-700 dark:text-gray-100"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-200">Etapas</label>
                <Button onClick={handleAddStep} size="sm" variant="outline" className="rounded-none dark:border-gray-600 dark:text-gray-200 dark:hover:bg-[#1f1f1f]">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Etapa
                </Button>
              </div>

              <ScrollArea className="h-64 border rounded-lg p-2 dark:border-gray-700 dark:bg-[#111111]">
                {steps.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground dark:text-gray-400">
                    Adicione etapas ao funil
                  </div>
                ) : (
                  <div className="space-y-3">
                    {steps.map((step, index) => (
                      <div key={step.id} className="border rounded-lg p-3 space-y-2 bg-white dark:bg-[#1a1a1a] dark:border-gray-700">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Etapa {index + 1}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRemoveStep(step.id)}
                            className="h-6 w-6 p-0 text-destructive"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block dark:text-gray-400">Tipo</label>
                            <Select
                              value={step.type}
                              onValueChange={(value) => handleUpdateStep(step.id, 'type', value)}
                            >
                              <SelectTrigger className="h-8 dark:bg-[#111111] dark:border-gray-700 dark:text-gray-100">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="dark:bg-[#111111] dark:border-gray-700">
                                <SelectItem value="message" className="dark:text-gray-100 dark:data-[state=checked]:bg-[#1f1f1f]">Mensagem</SelectItem>
                                <SelectItem value="audio" className="dark:text-gray-100 dark:data-[state=checked]:bg-[#1f1f1f]">Áudio</SelectItem>
                                <SelectItem value="media" className="dark:text-gray-100 dark:data-[state=checked]:bg-[#1f1f1f]">Mídia</SelectItem>
                                <SelectItem value="document" className="dark:text-gray-100 dark:data-[state=checked]:bg-[#1f1f1f]">Documento</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block dark:text-gray-400">Delay (segundos)</label>
                            <Input
                              type="number"
                              min="0"
                              value={step.delay_seconds}
                              onChange={(e) => handleUpdateStep(step.id, 'delay_seconds', parseInt(e.target.value) || 0)}
                              className="h-8 dark:bg-[#111111] dark:border-gray-700 dark:text-gray-100"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block dark:text-gray-400">Item</label>
                          <Select
                            value={step.item_id}
                            onValueChange={(value) => handleUpdateStep(step.id, 'item_id', value)}
                          >
                            <SelectTrigger className="h-8 dark:bg-[#111111] dark:border-gray-700 dark:text-gray-100">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent className="dark:bg-[#111111] dark:border-gray-700">
                              {getItemsByType(step.type).map((item: any) => (
                                <SelectItem key={item.id} value={item.id} className="dark:text-gray-100 dark:data-[state=checked]:bg-[#1f1f1f]">
                                  {item.title}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-[#e5e5e5] dark:border-gray-800">
              <Button variant="outline" onClick={() => { setMode('list'); setSteps([]); setFunnelTitle(''); }} className="rounded-none dark:border-gray-600 dark:text-gray-200 dark:hover:bg-[#1f1f1f]">
                Cancelar
              </Button>
              <Button 
                onClick={handleSaveFunnel} 
                disabled={!funnelTitle.trim() || steps.length === 0 || !steps.some(s => s.item_id)}
                className="rounded-none dark:bg-primary dark:text-primary-foreground"
              >
                Salvar Funil
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
