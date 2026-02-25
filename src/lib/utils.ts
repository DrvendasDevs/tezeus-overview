import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Paleta de cores vibrantes para conexões
export const CONNECTION_COLORS = [
  '#3B82F6', // Azul
  '#8B5CF6', // Roxo
  '#EC4899', // Rosa
  '#F97316', // Laranja
  '#10B981', // Verde
  '#06B6D4', // Ciano
  '#F59E0B', // Amarelo
  '#EF4444', // Vermelho
  '#6366F1', // Índigo
  '#14B8A6', // Teal
];

// Gera cor aleatória para nova conexão
export function getRandomConnectionColor(): string {
  return CONNECTION_COLORS[Math.floor(Math.random() * CONNECTION_COLORS.length)];
}

// Gera cor consistente baseada no ID da conexão
export function getConnectionColor(connectionId: string, metadata?: any): string {
  // Se já tem cor salva, usa ela
  if (metadata?.border_color) {
    return metadata.border_color;
  }
  
  // Senão, gera cor baseada no hash do ID
  let hash = 0;
  for (let i = 0; i < connectionId.length; i++) {
    hash = connectionId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % CONNECTION_COLORS.length;
  return CONNECTION_COLORS[index];
}
