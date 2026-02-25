import React, { forwardRef, useImperativeHandle, useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { parseActionText, getActionDisplayInfo } from "@/lib/action-parser";
import { X } from "lucide-react";

export interface ActionBadgeData {
  id: string;
  type: string;
  label: string;
  data: Record<string, any>;
  position: number;
}

interface RichPromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export interface PromptEditorRef {
  getCursorPosition: () => number;
  insertText: (text: string) => void;
}

type EditorNode = 
  | { type: 'text', content: string }
  | { type: 'action', content: string, id: string, position: number };

export const RichPromptEditor = forwardRef<PromptEditorRef, RichPromptEditorProps>(({
  value,
  onChange,
  placeholder,
  className,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFocused, setIsFocused] = useState(false);
  const isInternalUpdateRef = useRef(false);

  const extractValueFromDOM = (): string => {
    if (!containerRef.current) return "";
    
    let result = "";
    
    const processNode = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || "";
        result += text;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();
        
        if (el.classList.contains('inline-flex') && el.hasAttribute('data-action')) {
          // Se é um badge, adicionar o texto da ação
          result += el.getAttribute('data-action') || "";
        } else if (tagName === 'br') {
          // Elemento <br> representa uma quebra de linha
          result += '\n';
        } else if (tagName === 'div' || tagName === 'p') {
          // Para elementos de bloco, verificar se está vazio
          const isEmpty = el.textContent?.trim() === '' && el.children.length === 0;
          const hasOnlyBr = el.children.length === 1 && el.children[0].tagName.toLowerCase() === 'br';
          
          if (isEmpty || hasOnlyBr) {
            // Div vazio ou só com br = quebra de linha
            result += '\n';
          } else {
            // Processar filhos recursivamente
            Array.from(el.childNodes).forEach(processNode);
            // Se há próximo irmão, adiciona quebra de linha
            if (el.nextSibling) {
              result += '\n';
            }
          }
        } else {
          // Outros elementos: processar filhos recursivamente
          Array.from(node.childNodes).forEach(processNode);
        }
      }
    };

    // Processar todos os nós filhos do container
    Array.from(containerRef.current.childNodes).forEach(processNode);
    
    return result;
  };

  const renderContent = (text: string) => {
    if (!containerRef.current) return;

    const selection = window.getSelection();
    let savedOffset = 0;
    let savedNode: Node | null = null;

    // Salva posição do cursor
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      savedNode = range.startContainer;
      savedOffset = range.startOffset;
    }
    
    // Limpa o conteúdo atual
    containerRef.current.innerHTML = "";
    
    // Função auxiliar para renderizar texto com quebras de linha
    const renderTextWithLineBreaks = (textContent: string, container: HTMLElement) => {
      if (!textContent) return;
      
      // Dividir por quebras de linha
      const lines = textContent.split('\n');
      
      lines.forEach((line, lineIndex) => {
        // Adicionar o texto da linha
        if (line) {
          const textNode = document.createTextNode(line);
          container.appendChild(textNode);
        }
        
        // Adicionar <br> após cada linha, exceto a última
        if (lineIndex < lines.length - 1) {
          const br = document.createElement('br');
          container.appendChild(br);
        }
      });
    };
    
    // Parsear ações do texto
    const actions = parseActionText(text);
    let lastIndex = 0;
    
    actions.forEach((action, idx) => {
      // Texto antes da ação
      if (action.position > lastIndex) {
        const textContent = text.substring(lastIndex, action.position);
        if (textContent) {
          renderTextWithLineBreaks(textContent, containerRef.current!);
        }
      }
      
      // Obter informações da ação
      const actionInfo = getActionDisplayInfo(action.match);
      
      if (actionInfo) {
        // Criar badge usando DOM
        const badge = document.createElement('span');
        badge.setAttribute('contentEditable', 'false');
        badge.setAttribute('data-action', action.match);
        badge.setAttribute('data-action-id', `action-${action.position}-${idx}`);
        badge.className = cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border",
          "select-none transition-all duration-200",
          actionInfo.color
        );
        badge.style.userSelect = 'none';
        badge.style.margin = '0 2px';
        
        // Ícone (criar SVG baseado no tipo)
        const iconContainer = document.createElement('span');
        iconContainer.className = 'flex-shrink-0';
        iconContainer.innerHTML = getIconSVG(actionInfo.type);
        badge.appendChild(iconContainer);
        
        // Label
        const labelSpan = document.createElement('span');
        labelSpan.className = 'truncate max-w-[200px]';
        labelSpan.textContent = actionInfo.label;
        badge.appendChild(labelSpan);
        
        // Botão remover
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'ml-0.5 rounded-full p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100';
        removeBtn.setAttribute('aria-label', 'Remover ação');
        removeBtn.tabIndex = -1;
        removeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
        removeBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          handleRemoveAction(`action-${action.position}-${idx}`);
        };
        badge.appendChild(removeBtn);
        
        containerRef.current!.appendChild(badge);
      }
      
      lastIndex = action.position + action.match.length;
    });
    
    // Texto restante
    if (lastIndex < text.length) {
      const textContent = text.substring(lastIndex);
      if (textContent) {
        renderTextWithLineBreaks(textContent, containerRef.current!);
      }
    }
  };

  // Função auxiliar para obter SVG do ícone baseado no tipo
  const getIconSVG = (type: string): string => {
    const icons: Record<string, string> = {
      'adicionar_tag': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29a1 1 0 0 0 1.41 0l10-10a1 1 0 0 0 0-1.41L12 2Z"/><circle cx="7" cy="7" r="1.5"/></svg>',
      'transferir_fila': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.828L4 3"/><path d="m12 22 7-7-7-7v4.3a4 4 0 0 1 1.172 2.829L19.5 15"/></svg>',
      'transferir_conexao': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="m2 6 4-4 4 4"/><path d="m22 18-4 4-4-4"/></svg>',
      'criar_card': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16"/><path d="M6 16h12"/><path d="M8 12h8"/><rect width="20" height="4" x="2" y="4" rx="1"/></svg>',
      'transferir_coluna_crm': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>',
      'salvar_informacoes': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>',
      'enviar_funil': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
    };
    return icons[type] || icons['salvar_informacoes'];
  };

  // Renderiza o conteúdo inicial e quando value muda externamente
  useEffect(() => {
    if (!containerRef.current) return;

    // Se for uma atualização interna, ignora
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }

    const currentText = extractValueFromDOM();
    const newValue = value || "";
    
    // Só atualiza se o valor externo for diferente do atual
    if (currentText !== newValue) {
      renderContent(newValue);
    }
  }, [value]);

  const handleRemoveAction = (actionId: string) => {
    if (!containerRef.current) return;
    
    const badge = containerRef.current.querySelector(`[data-action-id="${actionId}"]`);
    if (badge) {
      badge.remove();
      isInternalUpdateRef.current = true;
      onChange(extractValueFromDOM());
    }
  };

  const getCursorPosition = (): number => {
    if (!containerRef.current) return 0;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return 0;
    
    const range = selection.getRangeAt(0);
    const preCaretRange = range.cloneRange();
    preCaretRange.selectNodeContents(containerRef.current);
    preCaretRange.setEnd(range.endContainer, range.endOffset);
    
    return preCaretRange.toString().length;
  };

  const insertText = (text: string) => {
    if (!containerRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    range.deleteContents();

    // Se for uma ação, insere como badge
    if (text.startsWith('[ADD_ACTION]:')) {
      const actionInfo = getActionDisplayInfo(text);
      const actionId = `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      if (actionInfo) {
        const badge = document.createElement('span');
        badge.setAttribute('contentEditable', 'false');
        badge.setAttribute('data-action', text);
        badge.setAttribute('data-action-id', actionId);
        badge.className = cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border",
          "select-none transition-all duration-200",
          actionInfo.color
        );
        badge.style.userSelect = 'none';
        badge.style.margin = '0 2px';
        
        // Ícone
        const iconContainer = document.createElement('span');
        iconContainer.className = 'flex-shrink-0';
        iconContainer.innerHTML = getIconSVG(actionInfo.type);
        badge.appendChild(iconContainer);
        
        // Label
        const labelSpan = document.createElement('span');
        labelSpan.className = 'truncate max-w-[200px]';
        labelSpan.textContent = actionInfo.label;
        badge.appendChild(labelSpan);
        
        // Botão remover
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'ml-0.5 rounded-full p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100';
        removeBtn.setAttribute('aria-label', 'Remover ação');
        removeBtn.tabIndex = -1;
        removeBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
        removeBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          handleRemoveAction(actionId);
        };
        badge.appendChild(removeBtn);
        
        range.insertNode(badge);
        range.setStartAfter(badge);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      } else {
        // Fallback: inserir como texto se não conseguir parsear
        const textNode = document.createTextNode(text);
        range.insertNode(textNode);
        range.setStartAfter(textNode);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    } else {
      // Insere texto normal
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    isInternalUpdateRef.current = true;
    onChange(extractValueFromDOM());
  };

  useImperativeHandle(ref, () => ({
    getCursorPosition,
    insertText,
  }));

  const handleContainerInput = () => {
    isInternalUpdateRef.current = true;
    onChange(extractValueFromDOM());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      insertText('\n');
    }
  };

  return (
    <div
      ref={containerRef}
      contentEditable
      suppressContentEditableWarning
      suppressHydrationWarning
      onInput={handleContainerInput}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={cn(
        "w-full min-h-[400px] p-4 rounded-md border border-input bg-background",
        "text-sm resize-none overflow-y-auto",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none",
        className
      )}
      data-placeholder={placeholder}
      style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
    />
  );
});

RichPromptEditor.displayName = "RichPromptEditor";
