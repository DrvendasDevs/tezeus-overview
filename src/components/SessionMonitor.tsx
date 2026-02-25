import { useSessionMonitor } from '@/hooks/useSessionMonitor';

/**
 * Componente que monitora sessões de usuário para login único.
 * Deve ser renderizado dentro do AuthProvider para ter acesso ao contexto.
 */
export const SessionMonitor = () => {
  useSessionMonitor();
  return null; // Componente não renderiza nada visualmente
};

