import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Zap, TrendingUp, Calendar, Bell, Newspaper, CalendarDays } from 'lucide-react';
import { DashboardCard } from '@/hooks/useDashboardCards';

interface DashboardCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (cardData: Omit<DashboardCard, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  card?: DashboardCard | null;
}

export function DashboardCardModal({ 
  isOpen, 
  onClose, 
  onSave, 
  card
}: DashboardCardModalProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'message' as 'message' | 'system' | 'achievement' | 'task' | 'update' | 'event',
    action_url: '',
    image_url: '',
    is_active: true,
    order_position: 1,
    event_date: '',
    event_location: '',
    event_instructor: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (card) {
      setFormData({
        title: card.title,
        description: card.description,
        type: card.type,
        action_url: card.action_url || '',
        image_url: card.image_url || '',
        is_active: card.is_active,
        order_position: card.order_position,
        event_date: card.metadata?.date || '',
        event_location: card.metadata?.location || '',
        event_instructor: card.metadata?.instructor || ''
      });
    } else {
      setFormData({
        title: '',
        description: '',
        type: 'message',
        action_url: '',
        image_url: '',
        is_active: true,
        order_position: 1,
        event_date: '',
        event_location: '',
        event_instructor: ''
      });
    }
  }, [card, isOpen]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="w-4 h-4" />;
      case 'system':
        return <Zap className="w-4 h-4" />;
      case 'achievement':
        return <TrendingUp className="w-4 h-4" />;
      case 'task':
        return <Calendar className="w-4 h-4" />;
      case 'update':
        return <Newspaper className="w-4 h-4" />;
      case 'event':
        return <CalendarDays className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'message':
        return 'text-primary bg-primary/10';
      case 'system':
        return 'text-warning bg-warning/10';
      case 'achievement':
        return 'text-success bg-success/10';
      case 'task':
        return 'text-accent bg-accent/10';
      case 'update':
        return 'text-info bg-info/10';
      case 'event':
        return 'text-purple bg-purple/10';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'message':
        return 'Conversa';
      case 'system':
        return 'Sistema';
      case 'achievement':
        return 'Conquista';
      case 'task':
        return 'Tarefa';
      case 'update':
        return 'Atualização';
      case 'event':
        return 'Evento';
      default:
        return 'Geral';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const metadata: any = {};
      if (formData.type === 'event') {
        if (formData.event_date) metadata.date = formData.event_date;
        if (formData.event_location) metadata.location = formData.event_location;
        if (formData.event_instructor) metadata.instructor = formData.event_instructor;
      }

      const { event_date, event_location, event_instructor, ...cardData } = formData;
      
      await onSave({
        ...cardData,
        workspace_id: null,
        metadata
      });
      onClose();
    } catch (error) {
      console.error('Error saving card:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {card ? 'Editar Card' : 'Criar Novo Card'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Digite o título do card"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Digite a descrição do card"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Select
                value={formData.type}
                onValueChange={(value: 'message' | 'system' | 'achievement' | 'task' | 'update' | 'event') =>
                  setFormData(prev => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="message">Conversa</SelectItem>
                  <SelectItem value="system">Sistema</SelectItem>
                  <SelectItem value="achievement">Conquista</SelectItem>
                  <SelectItem value="task">Tarefa</SelectItem>
                  <SelectItem value="update">Atualização</SelectItem>
                  <SelectItem value="event">Evento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="action_url">URL de Ação (opcional)</Label>
              <Input
                id="action_url"
                value={formData.action_url}
                onChange={(e) => setFormData(prev => ({ ...prev, action_url: e.target.value }))}
                placeholder="/caminho-da-pagina"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="image_url">URL da Imagem</Label>
              <Input
                id="image_url"
                value={formData.image_url}
                onChange={(e) => setFormData(prev => ({ ...prev, image_url: e.target.value }))}
                placeholder="https://exemplo.com/imagem.jpg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="order_position">Posição</Label>
              <Input
                id="order_position"
                type="number"
                min="1"
                value={formData.order_position}
                onChange={(e) => setFormData(prev => ({ ...prev, order_position: parseInt(e.target.value) || 1 }))}
              />
            </div>

            {formData.type === 'event' && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <Label className="text-sm font-medium">Detalhes do Evento</Label>
                
                <div className="space-y-2">
                  <Label htmlFor="event_date">Data e Hora</Label>
                  <Input
                    id="event_date"
                    type="datetime-local"
                    value={formData.event_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, event_date: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event_location">Local</Label>
                  <Input
                    id="event_location"
                    value={formData.event_location}
                    onChange={(e) => setFormData(prev => ({ ...prev, event_location: e.target.value }))}
                    placeholder="Ex: Auditório Principal"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="event_instructor">Instrutor/Responsável</Label>
                  <Input
                    id="event_instructor"
                    value={formData.event_instructor}
                    onChange={(e) => setFormData(prev => ({ ...prev, event_instructor: e.target.value }))}
                    placeholder="Nome do instrutor"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="is_active">Card ativo</Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? 'Salvando...' : (card ? 'Atualizar' : 'Criar')}
              </Button>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
            </div>
          </form>

          {/* Preview */}
          <div className="space-y-4">
            <Label>Preview do Card</Label>
            <Card className="relative overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-br from-primary/10 to-accent/10">
              <CardContent className="p-0">
                <div className="relative h-48 overflow-hidden">
                  {formData.image_url ? (
                    <img 
                      src={formData.image_url}
                      alt={formData.title}
                      className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400&h=200&fit=crop&crop=center';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center">
                      <span className="text-muted-foreground">Imagem do card</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  
                  {formData.is_active && (
                    <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">
                      Ativo
                    </Badge>
                  )}
                  
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`p-1.5 rounded-full ${getTypeColor(formData.type)}`}>
                        {getIcon(formData.type)}
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {getTypeLabel(formData.type)}
                      </Badge>
                    </div>
                    
                    <h3 className="font-semibold text-sm mb-1 line-clamp-1">
                      {formData.title || 'Título do card'}
                    </h3>
                    <p className="text-xs opacity-90 line-clamp-2 mb-2">
                      {formData.description || 'Descrição do card'}
                    </p>
                    <span className="text-xs opacity-75">
                      Agora
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}