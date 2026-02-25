import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Eye, X, Camera, EyeOff, ChevronDown } from "lucide-react";

import { useInstances } from "@/hooks/useInstances";
import { useChannels } from "@/hooks/useChannels";
import { useCargos } from "@/hooks/useCargos";
import { useSystemUsers, type SystemUser } from "@/hooks/useSystemUsers";


interface AdicionarUsuarioModalProps {
  isOpen: boolean;
  onClose: () => void;

  onAddUser: (user: Omit<SystemUser, "id" | "created_at" | "updated_at" | "cargo_id">) => void;

}

// Mock options para os selects
const mockQueues = [
  { value: "queue1", label: "Suporte Técnico" },
  { value: "queue2", label: "Vendas" },
  { value: "queue3", label: "Atendimento Geral" },
];

const mockPhones = [
  { value: "phone1", label: "+55 11 99999-9999" },
  { value: "phone2", label: "+55 11 88888-8888" },
  { value: "phone3", label: "+55 11 77777-7777" },
];

export function AdicionarUsuarioModal({ isOpen, onClose, onAddUser }: AdicionarUsuarioModalProps) {
  const [showPassword, setShowPassword] = useState(false);
  const { channels } = useChannels();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    profile: "user",
    password: "",
    temporaryPassword: false,
    queues: "",
    defaultChannel: "",
    defaultPhone: "",
  });

  const [focusedFields, setFocusedFields] = useState({
    name: false,
    email: false,
    profile: false,
    password: false,
    queues: false,
    defaultChannel: false,
    defaultPhone: false,
  });

  const handleSubmit = async () => {
    if (isSubmitting || !formData.name || !formData.email || !formData.password) {
      return;
    }

    setIsSubmitting(true);

    // Just call the callback with the form data
    // The parent component will handle the actual user creation
    onAddUser({
      name: formData.name,
      email: formData.email,
      profile: formData.profile,
      status: "active",
      avatar: null,
      default_channel: formData.defaultChannel || null,
    });

    // Reset form after successful submission
    setFormData({
      name: "",
      email: "",
      profile: "user",
      password: "",
      temporaryPassword: false,
      queues: "",
      defaultChannel: "",
      defaultPhone: "",
    });
    setShowPassword(false);
    onClose();
    setIsSubmitting(false);
  };

  const handleCancel = () => {
    setFormData({
      name: "",
      email: "",
      profile: "user",
      password: "",
      temporaryPassword: false,
      queues: "",
      defaultChannel: "",
      defaultPhone: "",
    });
    setShowPassword(false);
    onClose();
  };

  const updateFormData = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateFocus = (field: string, focused: boolean) => {
    setFocusedFields(prev => ({ ...prev, [field]: focused }));
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md max-h-[85vh] bg-white border-border flex flex-col p-0">
        {/* Fixed Header */}
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle className="text-lg font-semibold text-foreground">
            Adicionar usuário
          </DialogTitle>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {/* Avatar with camera overlay */}
            <div className="flex justify-center">
              <div className="relative">
                <img 
                  src="https://i.pinimg.com/236x/a8/da/22/a8da222be70a71e7858bf752065d5cc3.jpg" 
                  alt="Profile" 
                  className="h-16 w-16 rounded-full object-cover"
                />
                <div className="absolute bottom-0 right-0">
                  <input 
                    accept="image/*" 
                    className="hidden" 
                    id="icon-button-file" 
                    type="file"
                  />
                  <label htmlFor="icon-button-file">
                    <Button
                      type="button"
                      size="sm"
                      className="h-6 w-6 p-0 rounded-full bg-blue-600 hover:bg-blue-700 text-white border-0"
                      asChild
                    >
                      <span>
                        <Camera className="h-3 w-3" />
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
            </div>

            {/* Nome field */}
            <div className="relative">
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateFormData('name', e.target.value)}
                onFocus={() => updateFocus('name', true)}
                onBlur={() => updateFocus('name', false)}
                className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background appearance-none rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
              />
              <label
                className={`absolute left-3 transition-all duration-200 pointer-events-none ${
                  focusedFields.name || formData.name
                    ? 'text-xs text-primary -top-2 bg-white px-1'
                    : 'text-sm text-gray-500 top-3'
                }`}
              >
                Nome
              </label>
            </div>

            {/* Email and Perfil side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => updateFormData('email', e.target.value)}
                  onFocus={() => updateFocus('email', true)}
                  onBlur={() => updateFocus('email', false)}
                  className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background appearance-none rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
                />
                <label
                  className={`absolute left-3 transition-all duration-200 pointer-events-none ${
                    focusedFields.email || formData.email
                      ? 'text-xs text-primary -top-2 bg-white px-1'
                      : 'text-sm text-gray-500 top-3'
                  }`}
                >
                  Email
                </label>
              </div>

              <div className="relative">
                <select
                  value={formData.profile}
                  onChange={(e) => updateFormData('profile', e.target.value)}
                  onFocus={() => updateFocus('profile', true)}
                  onBlur={() => updateFocus('profile', false)}
                  className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background appearance-none rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
                >
                  <option value="" disabled hidden></option>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <label
                  className={`absolute left-3 transition-all duration-200 pointer-events-none ${
                    focusedFields.profile || formData.profile
                      ? 'text-xs text-primary -top-2 bg-white px-1'
                      : 'text-sm text-gray-500 top-3'
                  }`}
                >
                  Perfil
                </label>
              </div>
            </div>

            {/* Password field with eye icon */}
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => updateFormData('password', e.target.value)}
                onFocus={() => updateFocus('password', true)}
                onBlur={() => updateFocus('password', false)}
                className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background appearance-none rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary pr-12"
                style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-transparent"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-gray-500" />
                ) : (
                  <Eye className="h-4 w-4 text-gray-500" />
                )}
              </Button>
              <label
                className={`absolute left-3 transition-all duration-200 pointer-events-none ${
                  focusedFields.password || formData.password
                    ? 'text-xs text-primary -top-2 bg-white px-1'
                    : 'text-sm text-gray-500 top-3'
                }`}
              >
                Trocar Senha
              </label>
            </div>

            {/* Temporary password switch */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">Senha temporária</span>
              <Switch 
                checked={formData.temporaryPassword}
                onCheckedChange={(checked) => updateFormData('temporaryPassword', checked)}
              />
            </div>

            {/* Filas - Desabilitado temporariamente */}
            <div className="relative opacity-50">
              <select
                value={formData.queues}
                onChange={(e) => updateFormData('queues', e.target.value)}
                onFocus={() => updateFocus('queues', true)}
                onBlur={() => updateFocus('queues', false)}
                disabled
                className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background appearance-none rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary cursor-not-allowed"
                style={{ backgroundColor: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', borderColor: 'hsl(var(--border))' }}
              >
                <option value="" disabled hidden></option>
                {mockQueues.map((queue) => (
                  <option key={queue.value} value={queue.value}>
                    {queue.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <label
                className={`absolute left-3 transition-all duration-200 pointer-events-none ${
                  focusedFields.queues || formData.queues
                    ? 'text-xs text-gray-400 -top-2 bg-white px-1'
                    : 'text-sm text-gray-400 top-3'
                }`}
              >
                Filas (em breve)
              </label>
            </div>

            {/* Canal de atendimento padrão */}
            <div className="relative">
              <select
                value={formData.defaultChannel}
                onChange={(e) => updateFormData('defaultChannel', e.target.value)}
                onFocus={() => updateFocus('defaultChannel', true)}
                onBlur={() => updateFocus('defaultChannel', false)}
                className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background appearance-none rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
              >
                <option value="" disabled hidden></option>
                {channels.map((channel) => (
                  <option key={channel.id} value={channel.id}>
                    {channel.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <label
                className={`absolute left-3 transition-all duration-200 pointer-events-none ${
                  focusedFields.defaultChannel || formData.defaultChannel
                    ? 'text-xs text-yellow-500 -top-2 bg-white px-1'
                    : 'text-sm text-gray-500 top-3'
                }`}
              >
                Canal de atendimento Padrão
              </label>
            </div>

            {/* Telefone padrão */}
            <div className="relative">
              <select
                value={formData.defaultPhone}
                onChange={(e) => updateFormData('defaultPhone', e.target.value)}
                onFocus={() => updateFocus('defaultPhone', true)}
                onBlur={() => updateFocus('defaultPhone', false)}
                className="w-full h-12 pt-2 pb-2 px-3 border border-input text-sm ring-offset-background appearance-none rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500"
                style={{ backgroundColor: 'white', color: 'black', borderColor: 'rgb(229, 231, 235)' }}
              >
                <option value="" disabled hidden></option>
                {mockPhones.map((phone) => (
                  <option key={phone.value} value={phone.value}>
                    {phone.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              <label
                className={`absolute left-3 transition-all duration-200 pointer-events-none ${
                  focusedFields.defaultPhone || formData.defaultPhone
                    ? 'text-xs text-yellow-500 -top-2 bg-white px-1'
                    : 'text-sm text-gray-500 top-3'
                }`}
              >
                Telefone padrão
              </label>
            </div>

          </div>
        </div>

        {/* Fixed Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0">
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="flex-1 bg-white border-2 border-red-500 text-red-500 hover:bg-red-50 rounded-lg"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.name || !formData.email || !formData.password}
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground border-0 rounded-lg disabled:opacity-50"
            >
              {isSubmitting ? "Salvando..." : "Adicionar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}