import React, { useState, useEffect, useRef } from "react";
import { User, Eye, EyeOff, Plus, X, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { useWorkspaceConnections } from "@/hooks/useWorkspaceConnections";
import { useSystemUsers, type SystemUser } from "@/hooks/useSystemUsers";
import { useWorkspaceMembers } from "@/hooks/useWorkspaceMembers";
import { useCargos } from "@/hooks/useCargos";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { logCreate, logUpdate } from "@/utils/auditLog";

interface AdicionarEditarUsuarioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingUser?: SystemUser | null;
  onSuccess?: () => void;
  workspaceId?: string;
  lockWorkspace?: boolean;
}

export function AdicionarEditarUsuarioModal({ 
  open, 
  onOpenChange, 
  editingUser, 
  onSuccess,
  workspaceId,
  lockWorkspace
}: AdicionarEditarUsuarioModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const effectiveLockWorkspace = Boolean(workspaceId) || Boolean(lockWorkspace);
  
  // Form data
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    profile: 'user',
    senha: '',
    default_channel: '',
    phone: '',
    avatar: ''
  });

  const { toast } = useToast();
  const { userRole: currentUserRole } = useAuth();
  const { workspaces, isLoading: workspacesLoading } = useWorkspaces();
  const { connections, isLoading: connectionsLoading } = useWorkspaceConnections(selectedWorkspaceId);
  const { createUser, updateUser } = useSystemUsers();
  const { createUserAndAddToWorkspace } = useWorkspaceMembers(selectedWorkspaceId);

  const uploadAvatar = async (file: File, userId: string): Promise<string | null> => {
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('user-avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading avatar:', error);
      return null;
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "Arquivo muito grande",
          description: "O tamanho máximo é 5MB"
        });
        return;
      }
      
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveAvatar = () => {
    setAvatarFile(null);
    setAvatarPreview('');
    setFormData(prev => ({ ...prev, avatar: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Reset form when modal opens/closes or editing user changes
  useEffect(() => {
    if (open) {
      if (editingUser) {
        // Editing mode - populate form with existing data
        setFormData({
          name: editingUser.name || '',
          email: editingUser.email || '',
          profile: editingUser.profile || 'user',
          senha: '', // Never populate password for security
          default_channel: editingUser.default_channel || '',
          phone: '', // Phone not available in SystemUser type
          avatar: editingUser.avatar || ''
        });
        setAvatarPreview(editingUser.avatar || '');
        
        // Se o modal está travado para um workspace específico, sempre respeite o workspace atual.
        // Caso contrário, usa o primeiro workspace do usuário (se houver).
        if (workspaceId) {
          setSelectedWorkspaceId(workspaceId);
        } else if (editingUser.workspaces && editingUser.workspaces.length > 0) {
          setSelectedWorkspaceId(editingUser.workspaces[0].id);
        }
      } else {
        // Create mode - reset form
        setFormData({
          name: '',
          email: '',
          profile: 'user',
          senha: '',
          default_channel: '',
          phone: '',
          avatar: ''
        });
        setSelectedWorkspaceId(workspaceId || '');
        setAvatarFile(null);
        setAvatarPreview('');
      }
    }
  }, [open, editingUser, workspaceId]);

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !formData.profile) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    // Usuários master não fazem sentido no contexto de uma empresa (e não aparecem na lista de membros)
    if (effectiveLockWorkspace && formData.profile === 'master') {
      toast({
        title: "Erro",
        description: "Usuário Master não pode ser criado nesta tela. Use Administração de Usuários.",
        variant: "destructive"
      });
      return;
    }

    // Usuários 'support' só podem criar 'admin' e 'user'
    if (currentUserRole === 'support' && (formData.profile === 'master' || formData.profile === 'support')) {
      toast({
        title: "Erro",
        description: "Você não tem permissão para criar usuários deste perfil.",
        variant: "destructive"
      });
      return;
    }

    if (!editingUser && !formData.senha) {
      toast({
        title: "Erro",
        description: "Senha é obrigatória para novos usuários",
        variant: "destructive"
      });
      return;
    }

    // Usuários master e support não precisam de empresa (têm acesso a todas)
    const isGlobalProfile = formData.profile === 'master' || formData.profile === 'support';
    if (!isGlobalProfile && !selectedWorkspaceId) {
      toast({
        title: "Erro",
        description: "Selecione uma empresa",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);
    try {
    if (editingUser) {
      // Update existing user
      const updateData = {
        id: editingUser.id,
        name: formData.name,
        email: formData.email,
        profile: formData.profile,
        status: editingUser.status,
        phone: formData.phone,
        default_channel: formData.default_channel || null,
        // Only include password if it was changed
        ...(formData.senha && { senha: formData.senha })
      };

        const result = await updateUser(updateData);
        
        if (result.error) {
          throw new Error(result.error);
        }

        await logUpdate(
          'user',
          editingUser.id,
          formData.name || editingUser.name || 'Usuário',
          {
            name: editingUser.name,
            email: editingUser.email,
            profile: editingUser.profile,
            status: editingUser.status,
            default_channel: editingUser.default_channel || null
          },
          {
            name: formData.name,
            email: formData.email,
            profile: formData.profile,
            status: editingUser.status,
            default_channel: formData.default_channel || null
          },
          selectedWorkspaceId || null
        );

        toast({
          title: "Sucesso",
          description: "Usuário atualizado com sucesso"
        });
      } else {
        // Create new user
        const userData = {
          name: formData.name,
          email: formData.email,
          profile: formData.profile,
          senha: formData.senha,
          phone: formData.phone,
          default_channel: formData.default_channel || null
        };
        
        // Usuários master e support são criados sem vínculo específico com empresa
        // pois têm acesso a todas as empresas automaticamente
        const isGlobalProfile = formData.profile === 'master' || formData.profile === 'support';
        
        if (isGlobalProfile) {
          // Criar usuário global sem vincular a workspace
          const result = await createUser({
            name: userData.name,
            email: userData.email,
            profile: userData.profile,
            senha: userData.senha,
            default_channel: userData.default_channel || undefined,
            phone: userData.phone || undefined
          });

          const createdUserId = result?.data?.id;
          if (createdUserId) {
            await logCreate(
              'user',
              createdUserId,
              userData.name,
              {
                name: userData.name,
                email: userData.email,
                profile: userData.profile,
                status: 'active',
                default_channel: userData.default_channel || null
              },
              null
            );
          }
          
          toast({
            title: "Sucesso",
            description: `Usuário ${formData.profile === 'master' ? 'Master' : 'Sucesso do Cliente'} criado com sucesso`
          });
        } else {
          // Para usuários comuns, criar e vincular à empresa selecionada
          const memberRole = formData.profile === 'admin' ? 'admin' : 'user';

          const createdMember = await createUserAndAddToWorkspace(
            {
              name: userData.name,
              email: userData.email,
              profile: userData.profile,
              senha: userData.senha,
              default_channel: userData.default_channel || undefined,
              phone: userData.phone || undefined
            },
            memberRole
          );

          const createdUserId = (createdMember as any)?.user_id || (createdMember as any)?.user?.id;
          if (createdUserId) {
            await logCreate(
              'user',
              createdUserId,
              userData.name,
              {
                name: userData.name,
                email: userData.email,
                profile: userData.profile,
                status: 'active',
                default_channel: userData.default_channel || null
              },
              selectedWorkspaceId || null
            );
          }

          toast({
            title: "Sucesso",
            description: "Usuário criado e adicionado à empresa com sucesso"
          });
        }
      }

      // Reset form and close modal
      setFormData({
        name: '',
        email: '',
        profile: 'user',
        senha: '',
        default_channel: '',
        phone: '',
        avatar: ''
      });
      setSelectedWorkspaceId('');
      setAvatarFile(null);
      setAvatarPreview('');
      onOpenChange(false);
      
      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      console.error('Error saving user:', error);
      toast({
        title: "Erro",
        description: error.message || "Falha ao salvar usuário",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: '',
      email: '',
      profile: 'user',
      senha: '',
      default_channel: '',
      phone: '',
      avatar: ''
    });
    setSelectedWorkspaceId('');
    setAvatarFile(null);
    setAvatarPreview('');
    onOpenChange(false);
  };

  const isEditing = !!editingUser;
  const selectedWorkspaceName = selectedWorkspaceId
    ? workspaces.find((w) => w.workspace_id === selectedWorkspaceId)?.name
    : undefined;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(1280px,96vw)] max-w-none p-0 gap-0 border border-[#d4d4d4] bg-white dark:bg-[#1f1f1f] dark:border-gray-700 shadow-sm rounded-none overflow-hidden">
        <DialogHeader className="bg-primary px-6 py-5 rounded-none m-0 border-b border-[#d4d4d4] dark:border-gray-700 dark:bg-transparent">
          <DialogTitle className="flex items-center gap-2 text-primary-foreground text-lg font-bold dark:text-white">
            <User className="w-4 h-4 text-primary-foreground dark:text-white" />
            {isEditing ? 'Editar Usuário' : 'Adicionar Usuário'}
          </DialogTitle>
          <DialogDescription className="text-sm text-primary-foreground/80 mt-1 dark:text-gray-300">
            {isEditing
              ? (effectiveLockWorkspace ? 'Modifique os dados do usuário.' : 'Modifique os dados do usuário e selecione a empresa.')
              : (effectiveLockWorkspace ? 'Preencha os dados do novo usuário.' : 'Preencha os dados do novo usuário e selecione a empresa.')}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 bg-white dark:bg-[#1f1f1f]">
          <div className="grid grid-cols-12 gap-6 items-start">
          {/* Avatar Upload */}
          <div className="col-span-12 lg:col-span-3 border border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1f1f1f] p-5">
            <div className="flex items-center lg:flex-col lg:items-center gap-4">
            <div className="relative">
                <div className="w-20 h-20 rounded-full bg-[#f0f0f0] dark:bg-gray-800 flex items-center justify-center overflow-hidden border-2 border-[#d4d4d4] dark:border-gray-700">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="h-10 w-10 text-gray-500 dark:text-gray-400" />
                )}
              </div>
              {avatarPreview && (
                <button
                  onClick={handleRemoveAvatar}
                  className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full p-1 hover:bg-red-700"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

              <div className="min-w-0 flex-1 lg:flex-none">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                  className="h-9 px-4 text-sm rounded-none border-[#d4d4d4] dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 w-full lg:w-auto"
              >
                  <Camera className="h-4 w-4 mr-2" />
                {avatarPreview ? 'Alterar Foto' : 'Adicionar Foto'}
              </Button>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                JPG, PNG ou GIF (máx. 5MB)
              </p>
              </div>
            </div>
          </div>

          {/* Dados Básicos */}
          <div className="col-span-12 lg:col-span-6 border border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1f1f1f] p-5">
            <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-4">Dados Básicos</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300">Nome *</Label>
                <Input
                  id="name"
                  placeholder="Nome completo"
                  autoComplete="off"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="h-9 text-sm rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d] focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="usuario@exemplo.com"
                  autoComplete="off"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="h-9 text-sm rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d] focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="profile" className="text-sm font-medium text-gray-700 dark:text-gray-300">Perfil *</Label>
                <Select value={formData.profile} onValueChange={(value) => setFormData(prev => ({ ...prev, profile: value }))}>
                  <SelectTrigger className="h-9 text-sm rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-[#d4d4d4] dark:border-gray-700">
                    <SelectItem value="user">Usuário</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                    {/* Support só pode criar user e admin */}
                    {/* Master pode criar todos os perfis quando não está travado a workspace */}
                    {!effectiveLockWorkspace && currentUserRole === 'master' && (
                      <>
                        <SelectItem value="support">Sucesso do Cliente</SelectItem>
                        <SelectItem value="master">Master</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="senha" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {isEditing ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'}
                </Label>
                <div className="relative">
                  <Input
                    id="senha"
                    type={showPassword ? "text" : "password"}
                    placeholder={isEditing ? "Digite nova senha (opcional)" : "Digite a senha"}
                    // Prevent browser autofill/password managers from injecting stored credentials here
                    autoComplete={isEditing ? "new-password" : "new-password"}
                    value={formData.senha}
                    onChange={(e) => setFormData(prev => ({ ...prev, senha: e.target.value }))}
                    className="h-9 text-sm rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d] focus-visible:ring-1 focus-visible:ring-primary pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-gray-100 dark:hover:bg-gray-800"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="phone" className="text-sm font-medium text-gray-700 dark:text-gray-300">Telefone</Label>
                <Input
                  id="phone"
                  placeholder="(11) 99999-9999"
                  autoComplete="off"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  className="h-9 text-sm rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d] focus-visible:ring-1 focus-visible:ring-primary"
                />
              </div>

            </div>
          </div>

          {/* Empresa Selection */}
          <div className="col-span-12 lg:col-span-3 border border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1f1f1f] p-5">
            <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-4">Empresa</h3>

            {/* Perfis globais (master/support) não precisam de empresa específica */}
            {(formData.profile === 'master' || formData.profile === 'support') && (
              <div className="space-y-2">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-sm text-blue-700 dark:text-blue-300">
                  <p className="font-medium">Acesso Global</p>
                  <p className="text-xs mt-1">
                    Usuários {formData.profile === 'master' ? 'Master' : 'Sucesso do Cliente'} têm acesso a todas as empresas automaticamente.
                  </p>
                </div>
              </div>
            )}

            {formData.profile !== 'master' && formData.profile !== 'support' && !effectiveLockWorkspace && (
              <div className="space-y-2">
                <Label htmlFor="workspace" className="text-sm font-medium text-gray-700 dark:text-gray-300">Empresa *</Label>
                <Select value={selectedWorkspaceId} onValueChange={setSelectedWorkspaceId}>
                  <SelectTrigger className="h-9 text-sm rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d]">
                    <SelectValue placeholder="Selecione uma empresa" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-[#d4d4d4] dark:border-gray-700">
                    {workspaces.map((workspace) => (
                      <SelectItem key={workspace.workspace_id} value={workspace.workspace_id}>
                        {workspace.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
            </div>
          )}
          
          {formData.profile !== 'master' && formData.profile !== 'support' && effectiveLockWorkspace && selectedWorkspaceId && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Empresa</Label>
                <div className="h-9 flex items-center px-3 text-sm rounded-none border border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d] text-gray-900 dark:text-gray-200">
                  {selectedWorkspaceName || '—'}
              </div>
            </div>
          )}

          {formData.profile !== 'master' && formData.profile !== 'support' && selectedWorkspaceId && connections.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold text-sm text-gray-700 dark:text-gray-200 uppercase tracking-wide mb-3">Canal Padrão</h3>
                <div className="space-y-2">
                  <Label htmlFor="default_channel" className="text-sm font-medium text-gray-700 dark:text-gray-300">Canal WhatsApp</Label>
                <Select value={formData.default_channel} onValueChange={(value) => setFormData(prev => ({ ...prev, default_channel: value }))}>
                    <SelectTrigger className="h-9 text-sm rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d]">
                    <SelectValue placeholder="Selecione um canal (opcional)" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none border-[#d4d4d4] dark:border-gray-700">
                    {connections.map((connection) => (
                      <SelectItem key={connection.id} value={connection.id}>
                        {connection.instance_name || connection.phone_number || connection.id}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          </div>

          </div>
        </div>
          
        <div className="px-6 py-4 border-t border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#1f1f1f] flex items-center justify-end gap-3">
            <Button 
              variant="outline" 
              onClick={handleCancel}
              disabled={isSubmitting}
            className="h-9 px-5 text-sm rounded-none border-[#d4d4d4] dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              Cancelar
            </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.name || !formData.email || !formData.profile || (!isEditing && !formData.senha) || (formData.profile !== 'master' && formData.profile !== 'support' && !selectedWorkspaceId)}
            className="h-9 px-5 text-sm rounded-none bg-primary hover:bg-primary/90"
          >
            {isSubmitting ? (isEditing ? "Salvando..." : "Criando...") : (isEditing ? "Salvar Alterações" : "Criar Usuário")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}