import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, CheckCircle, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ProfileImageDebugProps {
  contactId: string;
  contactName: string;
  contactPhone: string;
  workspaceId: string;
  currentImageUrl?: string;
}

interface DebugResult {
  timestamp: string;
  contactId: string;
  phone: string;
  workspaceId: string;
  steps: string[];
  success: boolean;
  profileImageUrl: string | null;
  errors: string[];
}

export const ProfileImageDebug: React.FC<ProfileImageDebugProps> = ({
  contactId,
  contactName,
  contactPhone,
  workspaceId,
  currentImageUrl
}) => {
  const [loading, setLoading] = useState(false);
  const [debugResult, setDebugResult] = useState<DebugResult | null>(null);
  const { toast } = useToast();

  const handleFetchProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('debug-profile-images', {
        body: {
          contactId,
          phone: contactPhone,
          workspaceId,
          action: 'fetch_profile'
        }
      });

      if (error) {
        toast({
          title: "Erro",
          description: `Falha ao buscar imagem: ${error.message}`,
          variant: "destructive"
        });
        return;
      }

      setDebugResult(data);
      
      if (data.success) {
        toast({
          title: "Sucesso",
          description: "Imagem de perfil atualizada com sucesso!",
          variant: "default"
        });
      } else {
        toast({
          title: "Falha",
          description: "Não foi possível obter a imagem de perfil",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        title: "Erro",
        description: "Erro interno do servidor",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('debug-profile-images', {
        body: {
          contactId,
          phone: contactPhone,
          workspaceId,
          action: 'check_status'
        }
      });

      if (error) {
        toast({
          title: "Erro",
          description: `Falha ao verificar status: ${error.message}`,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Status da Imagem",
        description: data.hasImage 
          ? `Imagem encontrada, última atualização: ${new Date(data.lastUpdated).toLocaleString()}`
          : "Nenhuma imagem de perfil encontrada",
        variant: "default"
      });
    } catch (error) {
      console.error('Error checking status:', error);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          Debug - Imagem de Perfil
        </CardTitle>
        <CardDescription>
          Contato: {contactName} ({contactPhone})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant={currentImageUrl ? "default" : "secondary"}>
            {currentImageUrl ? "Com imagem" : "Sem imagem"}
          </Badge>
          {currentImageUrl && (
            <img 
              src={currentImageUrl} 
              alt="Perfil atual" 
              className="w-8 h-8 rounded-full object-cover"
            />
          )}
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={handleFetchProfile}
            disabled={loading}
            variant="default"
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Buscar Imagem
          </Button>
          
          <Button 
            onClick={handleCheckStatus}
            variant="outline"
          >
            Verificar Status
          </Button>
        </div>

        {debugResult && (
          <div className="space-y-4 mt-6">
            <div className="flex items-center gap-2">
              {debugResult.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              <h3 className="font-semibold">
                Resultado: {debugResult.success ? "Sucesso" : "Falha"}
              </h3>
            </div>

            {debugResult.profileImageUrl && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">URL encontrada:</span>
                <img 
                  src={debugResult.profileImageUrl} 
                  alt="Perfil encontrado" 
                  className="w-10 h-10 rounded-full object-cover"
                />
              </div>
            )}

            <div className="space-y-2">
              <h4 className="font-medium">Passos executados:</h4>
              <div className="bg-muted p-3 rounded-md text-sm">
                {debugResult.steps.map((step, index) => (
                  <div key={index} className="mb-1">
                    {step}
                  </div>
                ))}
              </div>
            </div>

            {debugResult.errors.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-red-600">Erros:</h4>
                <div className="bg-red-50 border border-red-200 p-3 rounded-md text-sm">
                  {debugResult.errors.map((error, index) => (
                    <div key={index} className="mb-1 text-red-700">
                      • {error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};