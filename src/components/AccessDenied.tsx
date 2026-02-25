import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

export const AccessDenied = () => {
  const navigate = useNavigate();
  const { userRole } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="rounded-full bg-destructive/10 p-3">
              <Shield className="h-8 w-8 text-destructive" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Acesso Negado</h1>
              <p className="text-muted-foreground">
                Você não tem permissão para acessar esta área.
              </p>
              <p className="text-sm text-muted-foreground">
                Seu nível atual: <span className="font-medium capitalize">{userRole}</span>
              </p>
            </div>

            <div className="space-y-2 w-full">
              <Button
                onClick={() => navigate(-1)}
                variant="outline"
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              
              <Button
                onClick={() => navigate('/relatorios')}
                className="w-full"
              >
                Ir para Dashboard
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};