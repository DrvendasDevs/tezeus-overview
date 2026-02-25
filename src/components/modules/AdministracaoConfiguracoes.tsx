import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppProvidersMaster } from "./master/WhatsAppProvidersMaster";
import { WorkspaceSelector } from "@/components/WorkspaceSelector";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ColorPickerModal } from "@/components/modals/ColorPickerModal";
import { useSystemCustomization } from "@/hooks/useSystemCustomization";
import { useAuth } from "@/hooks/useAuth";
import { Upload, RotateCcw, Palette } from "lucide-react";

export function AdministracaoConfiguracoes() {
  const [loading, setLoading] = useState(false);
  const { hasRole } = useAuth();
  const { 
    customization, 
    loading: customizationLoading, 
    updateCustomization, 
    resetToDefaults 
  } = useSystemCustomization();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreview, setFaviconPreview] = useState<string | null>(null);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  const [activeColorField, setActiveColorField] = useState<'primary' | 'background' | 'header' | 'sidebar' | null>(null);

  // Handle logo file selection
  const handleLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setLogoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle favicon file selection
  const handleFaviconChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFaviconFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setFaviconPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle customization updates
  const handleCustomizationUpdate = async (field: string, value: string) => {
    try {
      await updateCustomization({ [field]: value });
      toast({
        title: 'Personalização atualizada',
        description: 'As mudanças foram aplicadas com sucesso'
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleColorSelect = (color: string) => {
    if (activeColorField) {
      handleCustomizationUpdate(`${activeColorField}_color`, color);
    }
    setColorPickerOpen(false);
    setActiveColorField(null);
  };

  const openColorPicker = (field: 'primary' | 'background' | 'header' | 'sidebar') => {
    setActiveColorField(field);
    setColorPickerOpen(true);
  };

  // Handle logo upload
  const handleLogoUpload = async () => {
    if (!logoFile) return;

    try {
      setLoading(true);
      
      // Upload to Supabase storage
      const fileExt = logoFile.name.split('.').pop();
      const fileName = `system-logo-${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('workspace-media')
        .upload(fileName, logoFile);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('workspace-media')
        .getPublicUrl(fileName);

      // Update customization with new logo URL
      await updateCustomization({ logo_url: urlData.publicUrl });
      
      setLogoFile(null);
      setLogoPreview(null);
      
      toast({
        title: 'Logo atualizada',
        description: 'A nova logo foi aplicada com sucesso'
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao fazer upload',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle favicon upload
  const handleFaviconUpload = async () => {
    if (!faviconFile) return;

    try {
      setLoading(true);
      
      // Upload to Supabase storage
      const fileExt = faviconFile.name.split('.').pop();
      const fileName = `system-favicon-${Date.now()}.${fileExt}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('workspace-media')
        .upload(fileName, faviconFile);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('workspace-media')
        .getPublicUrl(fileName);

      // Update customization with new favicon URL
      await updateCustomization({ favicon_url: urlData.publicUrl });
      
      // Update the favicon in the document
      updateFaviconInDocument(urlData.publicUrl);
      
      setFaviconFile(null);
      setFaviconPreview(null);
      
      toast({
        title: 'Favicon atualizado',
        description: 'O novo favicon foi aplicado com sucesso. Recarregue a página para ver as mudanças.'
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao fazer upload',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Update favicon in document head
  const updateFaviconInDocument = (url: string) => {
    // Remove existing favicon links (incluindo o padrão do Lovable)
    const existingLinks = document.querySelectorAll("link[rel*='icon'], link[rel*='shortcut']");
    existingLinks.forEach(link => link.remove());
    
    // Add new favicon link
    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/x-icon';
    link.href = url;
    document.head.appendChild(link);
  };

  // Handle reset to defaults
  const handleResetDefaults = async () => {
    try {
      await resetToDefaults();
      toast({
        title: 'Configurações restauradas',
        description: 'O sistema foi restaurado para as configurações padrão'
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao restaurar',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white dark:bg-[#1f1f1f] border border-[#d4d4d4] dark:border-gray-700 shadow-sm">
        <Tabs defaultValue="personalizacao" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-[#f3f3f3] dark:bg-[#2d2d2d] rounded-none h-auto p-0 border-b border-[#d4d4d4] dark:border-gray-700">
            <TabsTrigger 
              value="personalizacao" 
              className="rounded-none py-3 px-6 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-[#FEF3C7] dark:data-[state=active]:bg-gray-700 data-[state=active]:text-black dark:data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-gray-300 dark:data-[state=active]:border-gray-600 data-[state=active]:shadow-none"
            >
              Personalização
            </TabsTrigger>
            <TabsTrigger 
              value="api-whatsapp" 
              className="rounded-none py-3 px-6 text-xs font-semibold uppercase tracking-wide data-[state=active]:bg-[#FEF3C7] dark:data-[state=active]:bg-gray-700 data-[state=active]:text-black dark:data-[state=active]:text-white data-[state=active]:border-b-2 data-[state=active]:border-gray-300 dark:data-[state=active]:border-gray-600 data-[state=active]:shadow-none"
            >
              API WhatsApp
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="personalizacao" className="p-6 mt-0 bg-white dark:bg-[#1f1f1f]">
            {hasRole(['master']) ? (
              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3 pb-4 border-b border-[#d4d4d4] dark:border-gray-700">
                  <Palette className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  <div>
                    <h2 className="text-sm font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">Personalização do Sistema</h2>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Configure a aparência global do sistema</p>
                  </div>
                </div>

                {/* Logo Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Logo do Sistema</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Upload de Logo
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoChange}
                          disabled={loading || customizationLoading}
                          className="flex-1 h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d]"
                        />
                        {logoFile && (
                          <Button 
                            onClick={handleLogoUpload} 
                            disabled={loading || customizationLoading}
                            size="sm"
                            className="h-8 px-3 text-xs rounded-none"
                          >
                            <Upload className="w-3.5 h-3.5 mr-1.5" />
                            Upload
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Preview
                      </Label>
                      <div className="w-32 h-20 border-2 border-dashed border-[#d4d4d4] dark:border-gray-700 rounded-none flex items-center justify-center bg-[#f0f0f0] dark:bg-[#2d2d2d]">
                        {logoPreview ? (
                          <img src={logoPreview} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                        ) : customization.logo_url ? (
                          <img src={customization.logo_url} alt="Current logo" className="max-w-full max-h-full object-contain" />
                        ) : (
                          <span className="text-xs text-gray-500 dark:text-gray-400">Nenhuma logo</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Favicon Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Favicon do Sistema</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Upload de Favicon
                      </Label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Formatos recomendados: .ico, .png (32x32 ou 16x16 pixels)
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/x-icon,image/png,image/svg+xml"
                          onChange={handleFaviconChange}
                          disabled={loading || customizationLoading}
                          className="flex-1 h-8 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d]"
                        />
                        {faviconFile && (
                          <Button 
                            onClick={handleFaviconUpload} 
                            disabled={loading || customizationLoading}
                            size="sm"
                            className="h-8 px-3 text-xs rounded-none"
                          >
                            <Upload className="w-3.5 h-3.5 mr-1.5" />
                            Upload
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        Preview
                      </Label>
                      <div className="w-16 h-16 border-2 border-dashed border-[#d4d4d4] dark:border-gray-700 rounded-none flex items-center justify-center bg-[#f0f0f0] dark:bg-[#2d2d2d]">
                        {faviconPreview ? (
                          <img src={faviconPreview} alt="Favicon preview" className="w-8 h-8 object-contain" />
                        ) : customization.favicon_url ? (
                          <img src={customization.favicon_url} alt="Current favicon" className="w-8 h-8 object-contain" />
                        ) : (
                          <span className="text-xs text-gray-500 dark:text-gray-400">Nenhum favicon</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Colors Section */}
                <div className="space-y-3">
                  <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">Cores do Sistema</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Cor Primária</Label>
                      <Button
                        variant="outline"
                        className="w-full h-16 p-2 flex flex-col items-center gap-1 rounded-none border-[#d4d4d4] dark:border-gray-700"
                        onClick={() => openColorPicker('primary')}
                        disabled={loading || customizationLoading}
                        style={{ backgroundColor: customization.primary_color }}
                      >
                        <div className="text-[10px] font-mono text-black">
                          {customization.primary_color}
                        </div>
                      </Button>
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Cor de Fundo</Label>
                      <Button
                        variant="outline"
                        className="w-full h-16 p-2 flex flex-col items-center gap-1 rounded-none border-[#d4d4d4] dark:border-gray-700"
                        onClick={() => openColorPicker('background')}
                        disabled={loading || customizationLoading}
                        style={{ backgroundColor: customization.background_color }}
                      >
                        <div className="text-[10px] font-mono text-white">
                          {customization.background_color}
                        </div>
                      </Button>
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Cor do Header</Label>
                      <Button
                        variant="outline"
                        className="w-full h-16 p-2 flex flex-col items-center gap-1 rounded-none border-[#d4d4d4] dark:border-gray-700"
                        onClick={() => openColorPicker('header')}
                        disabled={loading || customizationLoading}
                        style={{ backgroundColor: customization.header_color }}
                      >
                        <div className="text-[10px] font-mono text-white">
                          {customization.header_color}
                        </div>
                      </Button>
                    </div>
                    
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-gray-700 dark:text-gray-300">Cor da Sidebar</Label>
                      <Button
                        variant="outline"
                        className="w-full h-16 p-2 flex flex-col items-center gap-1 rounded-none border-[#d4d4d4] dark:border-gray-700"
                        onClick={() => openColorPicker('sidebar')}
                        disabled={loading || customizationLoading}
                        style={{ backgroundColor: customization.sidebar_color }}
                      >
                        <div className="text-[10px] font-mono text-white">
                          {customization.sidebar_color}
                        </div>
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t border-[#d4d4d4] dark:border-gray-700">
                  <Button 
                    variant="outline" 
                    onClick={handleResetDefaults}
                    disabled={loading || customizationLoading}
                    className="h-7 px-3 text-xs rounded-none border-[#d4d4d4] dark:border-gray-700"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                    Restaurar Padrão
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <Palette className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Acesso Restrito</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Apenas usuários master podem personalizar o sistema.
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="api-whatsapp" className="p-6 mt-0 bg-white dark:bg-[#1f1f1f]">
            <WhatsAppProvidersMaster />
          </TabsContent>


        </Tabs>
      </div>

      <ColorPickerModal
        open={colorPickerOpen}
        onOpenChange={setColorPickerOpen}
        onColorSelect={handleColorSelect}
      />
    </div>
  );
}