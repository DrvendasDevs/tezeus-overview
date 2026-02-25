import { useEffect } from 'react';

export function useFavicon(faviconUrl?: string) {
  useEffect(() => {
    // Sempre remover todos os favicons existentes (incluindo o padrão do Lovable)
    const existingLinks = document.querySelectorAll("link[rel*='icon'], link[rel*='shortcut']");
    existingLinks.forEach(link => link.remove());
    
    // Se houver favicon configurado, adicionar o novo
    if (faviconUrl) {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.type = 'image/x-icon';
      link.href = faviconUrl;
      document.head.appendChild(link);
    }
    // Se não houver favicon configurado, não adicionar nada (removendo o padrão)
  }, [faviconUrl]);
}
