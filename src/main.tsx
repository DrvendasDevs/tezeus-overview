import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { SystemCustomizationProvider } from './contexts/SystemCustomizationContext'

// Aplicar tema salvo imediatamente ao carregar
const savedTheme = localStorage.getItem('theme');
if (savedTheme && savedTheme !== 'light') {
  document.documentElement.classList.add(savedTheme);
}

// Silenciar erros de carregamento de imagens do WhatsApp (403/404)
// Usando flag para evitar registro duplicado em HMR (hot module replacement)
if (!(window as any).__whatsapp_img_error_handler) {
  (window as any).__whatsapp_img_error_handler = true;
  window.addEventListener('error', (event) => {
    const target = event.target as HTMLElement;
    if (target?.tagName === 'IMG') {
      const src = (target as HTMLImageElement).src || '';
      if (src.includes('pps.whatsapp.net') || src.includes('mmg.whatsapp.net')) {
        event.preventDefault();
        event.stopPropagation();
        return false;
      }
    }
  }, true);
}

createRoot(document.getElementById("root")!).render(
  <SystemCustomizationProvider>
    <App />
  </SystemCustomizationProvider>
);
