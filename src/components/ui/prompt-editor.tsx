import React, { forwardRef, useImperativeHandle, useRef, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { parseActionText, getActionDisplayInfo } from "@/lib/action-parser";

export interface ActionBadgeData {
  id: string;
  type: string;
  label: string;
  data: Record<string, any>;
  position: number;
}

// Alias para compatibilidade com PromptEditorModal
export type ActionBadge = ActionBadgeData;

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  resolveIdToken?: (id: string) => Promise<{ label: string; type: string; colorClass: string } | null>;
}

export interface PromptEditorRef {
  getCursorPosition: () => number;
  insertText: (text: string) => void;
  insertBadge: (opts: { token: string; label: string; type: string; colorClass: string }) => void;
}

export const PromptEditor = forwardRef<PromptEditorRef, PromptEditorProps>(({
  value,
  onChange,
  placeholder,
  className,
  resolveIdToken,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInternalUpdateRef = useRef(false);
  const [isFocused, setIsFocused] = useState(false);

  // Extrai o texto completo do DOM, substituindo badges por seus data-action
  const extractTextFromDOM = (): string => {
    if (!containerRef.current) return "";
    
    let result = "";
    
    const processNode = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent || "";
        result += text;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tagName = el.tagName.toLowerCase();
        
        if (el.hasAttribute('data-action')) {
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
      'status_oportunidade': '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    };
    return icons[type] || icons['salvar_informacoes'];
  };

  const createBadgeElement = (opts: { token: string; label: string; type: string; colorClass: string; actionId: string }) => {
    const badge = document.createElement('span');
    badge.setAttribute('contentEditable', 'false');
    // IMPORTANT: data-action is what gets serialized back to text
    badge.setAttribute('data-action', opts.token);
    badge.setAttribute('data-action-id', opts.actionId);
    badge.className = cn(
      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border",
      "select-none transition-all duration-200",
      opts.colorClass
    );
    badge.style.userSelect = 'none';
    badge.style.margin = '0 2px';
    badge.style.display = 'inline-flex';
    badge.style.verticalAlign = 'baseline';

    const iconContainer = document.createElement('span');
    iconContainer.className = 'flex-shrink-0';
    iconContainer.innerHTML = getIconSVG(opts.type);
    badge.appendChild(iconContainer);

    const labelSpan = document.createElement('span');
    labelSpan.className = 'truncate max-w-[240px]';
    labelSpan.textContent = opts.label;
    badge.appendChild(labelSpan);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className =
      'ml-0.5 rounded-full p-0.5 transition-colors hover:bg-black/10 dark:hover:bg-white/10 opacity-70 hover:opacity-100';
    removeBtn.setAttribute('aria-label', 'Remover ação');
    removeBtn.tabIndex = -1;
    removeBtn.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    removeBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleRemoveAction(opts.actionId);
    };
    badge.appendChild(removeBtn);

    return badge;
  };

  // Renderiza o conteúdo parseado com badges inline usando DOM
  const renderContent = (text: string) => {
    if (!containerRef.current) return;

    const selection = window.getSelection();
    let savedRange: Range | null = null;

    // Salvar posição do cursor
    if (selection && selection.rangeCount > 0) {
      try {
        const range = selection.getRangeAt(0);
        // Verificar se o range está dentro do container
        if (containerRef.current.contains(range.startContainer)) {
          savedRange = range.cloneRange();
        }
      } catch (e) {
        // Ignorar erros ao salvar range
      }
    }

    // Limpa o conteúdo atual de forma segura
    // Usar replaceChildren que é mais seguro e moderno
    try {
      // Criar um fragment vazio para limpar
      containerRef.current.replaceChildren();
    } catch (e) {
      // Fallback: limpar manualmente se replaceChildren não estiver disponível
      while (containerRef.current.firstChild) {
        try {
          containerRef.current.removeChild(containerRef.current.firstChild);
        } catch (err) {
          // Se falhar, tentar limpar de outra forma
          break;
        }
      }
    }

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

    // Parsear ações do texto (legado: [ADD_ACTION]) + tokens mínimos ([id: uuid])
    const actions = parseActionText(text).map(a => ({ kind: 'add_action' as const, ...a }));

    const idTokenRegex = /\[id:\s*([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\]/gi;
    const idTokens: Array<{ kind: 'id_token'; match: string; position: number; id: string }> = [];
    let m: RegExpExecArray | null;
    while ((m = idTokenRegex.exec(text)) !== null) {
      idTokens.push({
        kind: 'id_token',
        match: m[0],
        position: m.index,
        id: m[1],
      });
    }

    // Parsear tokens de status [status:aberto], [status:ganho], [status:perda]
    const statusTokenRegex = /\[status:(aberto|ganho|perda)\]/gi;
    const statusTokens: Array<{ kind: 'status_token'; match: string; position: number; status: string }> = [];
    let statusMatch: RegExpExecArray | null;
    while ((statusMatch = statusTokenRegex.exec(text)) !== null) {
      statusTokens.push({
        kind: 'status_token',
        match: statusMatch[0],
        position: statusMatch.index,
        status: statusMatch[1].toLowerCase(),
      });
    }

    const items = [...actions, ...idTokens, ...statusTokens].sort((a, b) => a.position - b.position);
    let lastIndex = 0;

    items.forEach((item, idx) => {
      // Texto antes da ação
      if (item.position > lastIndex) {
        const textContent = text.substring(lastIndex, item.position);
        if (textContent) {
          renderTextWithLineBreaks(textContent, containerRef.current!);
        }
      }

      if (item.kind === 'add_action') {
        const actionInfo = getActionDisplayInfo(item.match);
      if (actionInfo) {
          const badge = createBadgeElement({
            token: item.match,
            label: actionInfo.label,
            type: actionInfo.type,
            colorClass: actionInfo.color,
            actionId: `action-${item.position}-${idx}`,
          });
          containerRef.current!.appendChild(badge);
        } else {
          const textNode = document.createTextNode(item.match);
          containerRef.current!.appendChild(textNode);
        }
      } else if (item.kind === 'status_token') {
        // status_token: criar badge com cor baseada no status
        const statusItem = item as { kind: 'status_token'; match: string; position: number; status: string };
        const statusLabels: Record<string, string> = {
          'aberto': 'Status: Aberto',
          'ganho': 'Status: Ganho',
          'perda': 'Status: Perdido',
        };
        const statusColors: Record<string, string> = {
          'aberto': 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
          'ganho': 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700',
          'perda': 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700',
        };
        const badge = createBadgeElement({
          token: statusItem.match,
          label: statusLabels[statusItem.status] || `Status: ${statusItem.status}`,
          type: 'status_oportunidade',
          colorClass: statusColors[statusItem.status] || statusColors['aberto'],
          actionId: `action-${item.position}-${idx}`,
        });
        containerRef.current!.appendChild(badge);
      } else {
        // id_token: criar badge placeholder e resolver assíncrono para nome/ícone/cor
        const idItem = item as { kind: 'id_token'; match: string; position: number; id: string };
        const badge = createBadgeElement({
          token: idItem.match,
          label: 'Carregando…',
          type: 'id_token',
          colorClass:
            'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
          actionId: `action-${item.position}-${idx}`,
        });
        badge.setAttribute('data-resolve-id', idItem.id);
        badge.setAttribute('data-resolved', '0');
        containerRef.current!.appendChild(badge);
      }

      lastIndex = item.position + item.match.length;
    });

    // Texto restante
    if (lastIndex < text.length) {
      const textContent = text.substring(lastIndex);
      if (textContent) {
        renderTextWithLineBreaks(textContent, containerRef.current!);
      }
    }

    // Adicionar placeholder se estiver vazio e não focado
    if (!isFocused && containerRef.current.childNodes.length === 0 && placeholder) {
      const placeholderNode = document.createElement('span');
      placeholderNode.className = 'text-muted-foreground pointer-events-none select-none';
      placeholderNode.textContent = placeholder;
      containerRef.current.appendChild(placeholderNode);
    }

    // Tentar restaurar seleção (simplificado)
    if (savedRange && selection) {
      try {
        // Focar no container
        containerRef.current.focus();
      } catch (e) {
        // Ignorar erros
      }
    }
  };

  const resolveIdBadges = async () => {
    if (!containerRef.current || !resolveIdToken) return;
    const badges = Array.from(containerRef.current.querySelectorAll('span[data-resolve-id]')) as HTMLElement[];

    await Promise.all(
      badges.map(async (badge) => {
        const already = badge.getAttribute('data-resolved');
        if (already === '1') return;
        const id = badge.getAttribute('data-resolve-id') || '';
        if (!id) return;

        try {
          const resolved = await resolveIdToken(id);
          if (!resolved) {
            badge.setAttribute('data-resolved', '1');
            const labelSpan = badge.children?.[1] as HTMLElement | undefined;
            if (labelSpan) labelSpan.textContent = `ID: ${id}`;
            return;
          }

          // update class
          badge.className = cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border",
            "select-none transition-all duration-200",
            resolved.colorClass
          );

          const iconContainer = badge.children?.[0] as HTMLElement | undefined;
          const labelSpan = badge.children?.[1] as HTMLElement | undefined;
          if (iconContainer) iconContainer.innerHTML = getIconSVG(resolved.type);
          if (labelSpan) labelSpan.textContent = resolved.label;

          badge.setAttribute('data-resolved', '1');
        } catch {
          // keep as is
        }
      })
    );
  };

  // Renderizar conteúdo inicial
  useEffect(() => {
    if (!containerRef.current) return;
    
    // Aguardar um frame para garantir que o React terminou de montar
    requestAnimationFrame(() => {
      if (!containerRef.current) return;
      
      // Renderizar conteúdo inicial se o container estiver vazio
      if (containerRef.current.childNodes.length === 0 && value) {
        renderContent(value);
        // Resolver tokens [id: ...] também no render inicial
        requestAnimationFrame(() => {
          resolveIdBadges();
        });
      }
    });
  }, []);

  // Sincronizar conteúdo quando value mudar externamente
  useEffect(() => {
    if (!containerRef.current) return;

    // Se for uma atualização interna, ignora
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }

    // Aguardar um frame para evitar conflitos com o React
    requestAnimationFrame(() => {
      if (!containerRef.current) return;
      
      // Verificar se o conteúdo atual do DOM é diferente do value
      const currentText = extractTextFromDOM();
      const newValue = value || "";
      
      // Só atualiza se o valor externo for diferente do atual
      if (currentText !== newValue) {
        renderContent(newValue);
      }

      // Mesmo quando o texto é igual, pode haver badges em "Carregando…"
      // (ex.: reabriu modal com o mesmo value). Tentar resolver sempre.
      requestAnimationFrame(() => {
        resolveIdBadges();
      });
    });
  }, [value]);

  // Função para remover ação do texto
  const handleRemoveAction = (actionId: string) => {
    if (!containerRef.current) return;
    
    const badge = containerRef.current.querySelector(`[data-action-id="${actionId}"]`);
    if (badge) {
      const actionText = badge.getAttribute('data-action') || '';
      badge.remove();
      isInternalUpdateRef.current = true;
      const newValue = extractTextFromDOM();
      onChange(newValue);
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

    // Contar caracteres, substituindo badges por seus data-action
    let position = 0;
    const walker = document.createTreeWalker(
      containerRef.current,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node === range.endContainer) {
        if (node.nodeType === Node.TEXT_NODE) {
          position += range.endOffset;
        } else if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.hasAttribute('data-action')) {
            position += el.getAttribute('data-action')?.length || 0;
          }
        }
        break;
      }

      if (node.nodeType === Node.TEXT_NODE) {
        position += node.textContent?.length || 0;
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.hasAttribute('data-action')) {
          position += el.getAttribute('data-action')?.length || 0;
        }
      }
    }

    return position;
  };

  const insertText = (text: string) => {
    if (!containerRef.current) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      // Se não houver seleção, focar no container e inserir no final
      containerRef.current.focus();
      const textNode = document.createTextNode(text);
      containerRef.current.appendChild(textNode);
      
      // Mover cursor para o final
      const range = document.createRange();
      range.selectNodeContents(textNode);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
      
      isInternalUpdateRef.current = true;
      onChange(extractTextFromDOM());
      return;
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();

    // Se for uma ação, insere como badge
    if (text.trim().startsWith('[ADD_ACTION]:')) {
      const actionInfo = getActionDisplayInfo(text.trim());
      const actionId = `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      if (actionInfo) {
        const badge = document.createElement('span');
        badge.setAttribute('contentEditable', 'false');
        badge.setAttribute('data-action', text.trim());
        badge.setAttribute('data-action-id', actionId);
        badge.className = cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border",
          "select-none transition-all duration-200",
          actionInfo.color
        );
        badge.style.userSelect = 'none';
        badge.style.margin = '0 2px';
        badge.style.display = 'inline-flex';
        badge.style.verticalAlign = 'baseline';
        
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
      // Inserir texto normal
      const textNode = document.createTextNode(text);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    isInternalUpdateRef.current = true;
    onChange(extractTextFromDOM());
  };

  const insertBadge = (opts: { token: string; label: string; type: string; colorClass: string }) => {
    if (!containerRef.current) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      containerRef.current.focus();
      return;
    }

    const range = selection.getRangeAt(0);
    range.deleteContents();

    const actionId = `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const badge = createBadgeElement({ ...opts, actionId });

    range.insertNode(badge);
    range.setStartAfter(badge);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);

    isInternalUpdateRef.current = true;
    onChange(extractTextFromDOM());
  };

  useImperativeHandle(ref, () => ({
    getCursorPosition,
    insertText,
    insertBadge,
  }));

  const handleInput = () => {
    isInternalUpdateRef.current = true;
    const newValue = extractTextFromDOM();
    
    // Remover placeholder se houver conteúdo
    if (containerRef.current && newValue.trim() !== '') {
      const placeholderNode = containerRef.current.querySelector('.text-muted-foreground.pointer-events-none');
      if (placeholderNode) {
        placeholderNode.remove();
      }
    }
    
    onChange(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevenir Backspace/Delete em badges
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        let node: Node | null = range.startContainer;

        // Verificar se está tentando deletar um badge
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.hasAttribute('data-action')) {
            e.preventDefault();
            const actionId = el.getAttribute('data-action-id') || '';
            if (actionId) {
              handleRemoveAction(actionId);
            }
            return;
          }
        }

        // Verificar se o nó pai é um badge
        let parent = node.parentElement;
        while (parent && parent !== containerRef.current) {
          if (parent.hasAttribute('data-action')) {
            e.preventDefault();
            const actionId = parent.getAttribute('data-action-id') || '';
            if (actionId) {
              handleRemoveAction(actionId);
            }
            return;
          }
          parent = parent.parentElement;
        }
      }
    }
  };

  return (
    <div
      ref={containerRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onFocus={() => {
        setIsFocused(true);
        // Remover placeholder ao focar
        if (containerRef.current) {
          const placeholderNode = containerRef.current.querySelector('.text-muted-foreground.pointer-events-none');
          if (placeholderNode) {
            placeholderNode.remove();
          }
        }
      }}
      onBlur={() => {
        setIsFocused(false);
        // Adicionar placeholder se estiver vazio
        if (containerRef.current && extractTextFromDOM().trim() === '' && placeholder) {
          const placeholderNode = document.createElement('span');
          placeholderNode.className = 'text-muted-foreground pointer-events-none select-none';
          placeholderNode.textContent = placeholder;
          containerRef.current.appendChild(placeholderNode);
        }
      }}
      className={cn(
        "w-full min-h-[400px] p-4 rounded-md border border-input bg-background",
        "font-mono text-sm resize-none overflow-y-auto",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "dark:bg-[#1a1a1a] dark:text-gray-100 dark:border-gray-700 dark:placeholder:text-gray-500 dark:focus-visible:ring-offset-[#1a1a1a]",
        className
      )}
      style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      data-placeholder={placeholder}
    />
  );
});

PromptEditor.displayName = "PromptEditor";
