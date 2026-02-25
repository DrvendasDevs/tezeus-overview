import { useState, useEffect, useCallback, useRef, RefObject } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UseFloatingDateReturn {
  floatingDate: string | null;
  shouldShowFloating: boolean;
}

export function useFloatingDate(
  scrollRef: RefObject<HTMLElement>,
  messages: any[]
): UseFloatingDateReturn {
  const [floatingDate, setFloatingDate] = useState<string | null>(null);
  const [shouldShowFloating, setShouldShowFloating] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollStopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const formatDateLabel = useCallback((date: Date): string => {
    if (isToday(date)) return 'Hoje';
    if (isYesterday(date)) return 'Ontem';
    
    // Se for da mesma semana, mostrar dia da semana
    const daysDiff = Math.floor((new Date().getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff < 7) {
      return format(date, 'EEEE', { locale: ptBR });
    }
    
    // Caso contrário, mostrar data completa
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current || messages.length === 0) {
      setShouldShowFloating(false);
      return;
    }

    const scrollContainer = scrollRef.current;
    const scrollTop = scrollContainer.scrollTop;
    const containerRect = scrollContainer.getBoundingClientRect();
    
    // Encontrar qual data corresponde às mensagens visíveis no viewport
    const dateSeparators = scrollContainer.querySelectorAll('[data-date-separator]');
    
    let currentVisibleDate: string | null = null;
    let firstSeparatorTop: number | null = null;
    
    // Percorrer todos os separadores para encontrar qual seção está visível
    dateSeparators.forEach((separator, index) => {
      const rect = separator.getBoundingClientRect();
      const separatorTop = rect.top - containerRect.top;
      const dateLabel = separator.getAttribute('data-date-separator');
      
      // Se o separador está acima do viewport (ou muito próximo do topo)
      // Isso significa que estamos vendo as mensagens DESTA data
      if (separatorTop < 100) {
        currentVisibleDate = dateLabel;
        if (index === 0) {
          firstSeparatorTop = separatorTop;
        }
      }
    });
    
    // Verificar se o primeiro separador está muito próximo do topo (visível)
    const isFirstSeparatorVisible = firstSeparatorTop !== null && firstSeparatorTop >= 0 && firstSeparatorTop < 80;
    
    // Limpar timeout anterior se existir
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    
    // Limpar timeout de parada de scroll
    if (scrollStopTimeoutRef.current) {
      clearTimeout(scrollStopTimeoutRef.current);
      scrollStopTimeoutRef.current = null;
    }
    
    // Mostrar o flutuante se:
    // 1. Rolou para cima (scrollTop > 50)
    // 2. O primeiro separador não está visível no topo
    // 3. Há uma data identificada
    if (scrollTop > 50 && !isFirstSeparatorVisible && currentVisibleDate) {
      setFloatingDate(currentVisibleDate);
      setShouldShowFloating(true);
      
      // Timer para esconder após 1 segundo sem rolar
      scrollStopTimeoutRef.current = setTimeout(() => {
        setShouldShowFloating(false);
      }, 1000);
    } else {
      // Adicionar delay antes de esconder para evitar piscar
      hideTimeoutRef.current = setTimeout(() => {
        setShouldShowFloating(false);
      }, 150);
    }
  }, [scrollRef, messages]);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (!scrollContainer) return;

    scrollContainer.addEventListener('scroll', handleScroll);
    
    // Verificar inicialmente
    handleScroll();

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
      if (scrollStopTimeoutRef.current) {
        clearTimeout(scrollStopTimeoutRef.current);
      }
    };
  }, [scrollRef, handleScroll]);

  return {
    floatingDate,
    shouldShowFloating
  };
}

// 🕐 Helper para obter timestamp real da mensagem (prioriza provider_moment)
export function getMessageTimestamp(message: any): Date {
  // Prioridade: provider_moment (timestamp Unix ms) > created_at
  if (message.provider_moment && typeof message.provider_moment === 'number') {
    return new Date(message.provider_moment);
  }
  return new Date(message.created_at);
}

// Função auxiliar para formatar data de mensagem
export function formatMessageDate(date: Date | string | number): string {
  let messageDate: Date;
  
  if (typeof date === 'number') {
    // É um timestamp Unix em ms (provider_moment)
    messageDate = new Date(date);
  } else if (typeof date === 'string') {
    messageDate = new Date(date);
  } else {
    messageDate = date;
  }
  
  if (isToday(messageDate)) return 'Hoje';
  if (isYesterday(messageDate)) return 'Ontem';
  
  const daysDiff = Math.floor((new Date().getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7) {
    return format(messageDate, 'EEEE', { locale: ptBR });
  }
  
  return format(messageDate, 'dd/MM/yyyy', { locale: ptBR });
}

// Função para agrupar mensagens por data (usa provider_moment como prioridade)
export function groupMessagesByDate(messages: any[]): Map<string, any[]> {
  const grouped = new Map<string, any[]>();
  
  messages.forEach(message => {
    // 🕐 Usar provider_moment se disponível, fallback para created_at
    const messageDate = getMessageTimestamp(message);
    const dateKey = format(messageDate, 'yyyy-MM-dd');
    
    if (!grouped.has(dateKey)) {
      grouped.set(dateKey, []);
    }
    grouped.get(dateKey)!.push(message);
  });
  
  return grouped;
}
