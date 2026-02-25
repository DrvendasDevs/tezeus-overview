import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, MoreHorizontal, Edit, Trash2, MessageSquare, Zap, TrendingUp, Calendar, Bell, Search, Filter, Newspaper, CalendarDays } from 'lucide-react';
import { useDashboardCards, DashboardCard } from '@/hooks/useDashboardCards';
import { DashboardCardModal } from '@/components/modals/DashboardCardModal';
import { useToast } from '@/hooks/use-toast';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function AdministracaoDashboard() {
  const { cards, loading, createCard, updateCard, deleteCard } = useDashboardCards();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<DashboardCard | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; card: DashboardCard | null }>({
    open: false,
    card: null
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { toast } = useToast();

  const filteredCards = cards.filter(card => {
    const matchesSearch = card.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         card.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = typeFilter === 'all' || card.type === typeFilter;
    const matchesStatus = statusFilter === 'all' || 
                         (statusFilter === 'active' ? card.is_active : !card.is_active);
    
    return matchesSearch && matchesType && matchesStatus;
  });

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

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'message':
        return 'bg-primary/10 text-primary';
      case 'system':
        return 'bg-warning/10 text-warning';
      case 'achievement':
        return 'bg-success/10 text-success';
      case 'task':
        return 'bg-accent/10 text-accent';
      case 'update':
        return 'bg-info/10 text-info';
      case 'event':
        return 'bg-purple/10 text-purple';
      default:
        return 'bg-muted/10 text-muted-foreground';
    }
  };

  const handleCreateCard = () => {
    setEditingCard(null);
    setModalOpen(true);
  };

  const handleEditCard = (card: DashboardCard) => {
    setEditingCard(card);
    setModalOpen(true);
  };

  const handleSaveCard = async (cardData: Omit<DashboardCard, 'id' | 'created_at' | 'updated_at'>) => {
    if (editingCard) {
      await updateCard(editingCard.id, cardData);
    } else {
      await createCard(cardData);
    }
  };

  const handleDeleteCard = (card: DashboardCard) => {
    setDeleteDialog({ open: true, card });
  };

  const confirmDelete = async () => {
    if (deleteDialog.card) {
      await deleteCard(deleteDialog.card.id);
      setDeleteDialog({ open: false, card: null });
    }
  };

  const handleToggleActive = async (card: DashboardCard) => {
    await updateCard(card.id, { is_active: !card.is_active });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando cards...</p>
        </div>
      </div>
    );
  }

  const allCards = filteredCards;
  const updateCards = filteredCards.filter(card => card.type === 'update');
  const eventCards = filteredCards.filter(card => card.type === 'event');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gerenciar Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Configure os cards exibidos no dashboard principal
          </p>
        </div>
        <Button onClick={handleCreateCard}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Card
        </Button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-primary/10 rounded-lg">
                <MessageSquare className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Cards</p>
                <p className="text-xl font-bold">{cards.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-success/10 rounded-lg">
                <TrendingUp className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cards Ativos</p>
                <p className="text-xl font-bold">{cards.filter(c => c.is_active).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-warning/10 rounded-lg">
                <Zap className="w-4 h-4 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cards Inativos</p>
                <p className="text-xl font-bold">{cards.filter(c => !c.is_active).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Calendar className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tipos Únicos</p>
                <p className="text-xl font-bold">{new Set(cards.map(c => c.type)).size}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-4 h-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Buscar por título ou descrição..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar por tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="message">Conversa</SelectItem>
                <SelectItem value="system">Sistema</SelectItem>
                <SelectItem value="achievement">Conquista</SelectItem>
                <SelectItem value="task">Tarefa</SelectItem>
                <SelectItem value="update">Atualização</SelectItem>
                <SelectItem value="event">Evento</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabelas com Abas */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">Todos os Cards ({allCards.length})</TabsTrigger>
          <TabsTrigger value="updates">Atualizações ({updateCards.length})</TabsTrigger>
          <TabsTrigger value="events">Eventos ({eventCards.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Todos os Cards do Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Card</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Posição</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allCards.map((card) => (
                    <TableRow key={card.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          {card.image_url && (
                            <img 
                              src={card.image_url} 
                              alt={card.title}
                              className="w-10 h-10 rounded object-cover"
                            />
                          )}
                          <div>
                            <p className="font-medium">{card.title}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {card.description}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={getTypeColor(card.type)}>
                          <span className="flex items-center gap-1">
                            {getIcon(card.type)}
                            {getTypeLabel(card.type)}
                          </span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {card.action_url ? (
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {card.action_url}
                          </code>
                        ) : (
                          <span className="text-muted-foreground">Sem ação</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={card.is_active}
                            onCheckedChange={() => handleToggleActive(card)}
                          />
                          <Badge variant={card.is_active ? "default" : "secondary"}>
                            {card.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {card.order_position}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditCard(card)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteCard(card)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {allCards.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    {searchTerm || typeFilter !== 'all' || statusFilter !== 'all' 
                      ? 'Nenhum card encontrado com os filtros aplicados.' 
                      : 'Nenhum card criado ainda.'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="updates" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Newspaper className="w-5 h-5" />
                Atualizações do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Atualização</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Posição</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {updateCards.map((card) => (
                    <TableRow key={card.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          {card.image_url && (
                            <img 
                              src={card.image_url} 
                              alt={card.title}
                              className="w-10 h-10 rounded object-cover"
                            />
                          )}
                          <div>
                            <p className="font-medium">{card.title}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {card.description}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {card.action_url ? (
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {card.action_url}
                          </code>
                        ) : (
                          <span className="text-muted-foreground">Sem ação</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={card.is_active}
                            onCheckedChange={() => handleToggleActive(card)}
                          />
                          <Badge variant={card.is_active ? "default" : "secondary"}>
                            {card.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {card.order_position}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditCard(card)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteCard(card)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {updateCards.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Nenhuma atualização criada ainda.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                Eventos Programados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Evento</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Posição</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventCards.map((card) => (
                    <TableRow key={card.id}>
                      <TableCell>
                        <div className="flex items-center space-x-3">
                          {card.image_url && (
                            <img 
                              src={card.image_url} 
                              alt={card.title}
                              className="w-10 h-10 rounded object-cover"
                            />
                          )}
                          <div>
                            <p className="font-medium">{card.title}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {card.description}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {card.action_url ? (
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {card.action_url}
                          </code>
                        ) : (
                          <span className="text-muted-foreground">Sem ação</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={card.is_active}
                            onCheckedChange={() => handleToggleActive(card)}
                          />
                          <Badge variant={card.is_active ? "default" : "secondary"}>
                            {card.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {card.order_position}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditCard(card)}>
                              <Edit className="w-4 h-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => handleDeleteCard(card)}
                              className="text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {eventCards.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Nenhum evento criado ainda.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modal de criação/edição */}
      <DashboardCardModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveCard}
        card={editingCard}
      />

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, card: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o card "{deleteDialog.card?.title}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}