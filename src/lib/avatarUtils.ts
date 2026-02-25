/**
 * Funções utilitárias para avatares
 * Garante consistência visual em toda a aplicação
 */

export const getInitials = (name: string) => {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

export const getAvatarColor = (name: string) => {
  const colors = [
    '#ef4444', // vermelho
    '#3b82f6', // azul
    '#10b981', // verde
    '#f59e0b', // laranja
    '#8b5cf6', // roxo
    '#ec4899', // rosa
    '#6366f1', // índigo
    '#f97316'  // laranja escuro
  ];
  const index = name.charCodeAt(0) % colors.length;
  return colors[index];
};
