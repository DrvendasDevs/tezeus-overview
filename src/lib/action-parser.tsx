import { 
  Tag, 
  ArrowRightLeft, 
  Shuffle, 
  FolderKanban, 
  ArrowRight, 
  Database, 
  ListFilter,
  CheckSquare
} from "lucide-react";
import { ReactNode } from "react";

export interface ActionDisplayInfo {
  type: string;
  label: string;
  icon: ReactNode;
  color: string;
  values: Record<string, string>;
}

/**
 * Verifica se um texto é uma ação [ADD_ACTION]
 */
export function isActionText(text: string): boolean {
  return text.trim().startsWith('[ADD_ACTION]:');
}

/**
 * Extrai valores dos parâmetros de uma ação
 */
function extractActionValues(actionText: string): Record<string, string> {
  const values: Record<string, string> = {};
  const paramMatches = actionText.match(/\[([^\]]+)\]/g);
  
  if (paramMatches) {
    paramMatches.forEach(param => {
      const paramText = param.replace(/[\[\]]/g, '');
      const colonIndex = paramText.indexOf(':');
      
      if (colonIndex > 0) {
        const key = paramText.substring(0, colonIndex).trim();
        const value = paramText.substring(colonIndex + 1).trim();
        values[key] = value;
      }
    });
  }
  
  return values;
}

/**
 * Parseia uma ação e retorna informações para exibição
 */
export function getActionDisplayInfo(actionText: string): ActionDisplayInfo | null {
  if (!isActionText(actionText)) {
    return null;
  }

  const values = extractActionValues(actionText);

  // Qualificar cliente (Negócio)
  // Esperado:
  // [ADD_ACTION]: [workspace_id: WORKSPACE_ID], [card_id: ID_DO_CARD], [qualification: qualified|disqualified], [qualification_title: Qualificado|Desqualificado]
  const qualifyMatch = actionText.match(
    /\[ADD_ACTION\]:\s*\[workspace_id:\s*(.*?)\]\s*,\s*\[card_id:\s*(.*?)\]\s*,\s*\[qualification:\s*(.*?)\](?:\s*,\s*\[qualification_title:\s*(.*?)\])?/i
  );
  if (qualifyMatch) {
    const qualification = (qualifyMatch[3] || '').trim().toLowerCase();
    const titleFromText = (qualifyMatch[4] || '').trim();
    const title =
      titleFromText ||
      (qualification === 'qualified'
        ? 'Qualificado'
        : qualification === 'disqualified'
        ? 'Desqualificado'
        : 'Selecionar');

    const isQualified = qualification === 'qualified';
    const isDisqualified = qualification === 'disqualified';

    return {
      type: 'qualificar_cliente',
      label: `Qualificar cliente: ${title}`,
      icon: <CheckSquare className="w-3.5 h-3.5" />,
      color: isQualified
        ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700'
        : isDisqualified
        ? 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700'
        : 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
      values: {
        ...values,
        workspace_id: (qualifyMatch[1] || '').trim(),
        card_id: (qualifyMatch[2] || '').trim(),
        qualification,
        qualification_title: title,
      },
    };
  }

  // Adicionar Tag (agora só exige tag_id)
  if (values.tag_id) {
    return {
      type: 'adicionar_tag',
      label: 'Adicionar Tag',
      icon: <Tag className="w-3.5 h-3.5" />,
      color: 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-700',
      values: { ...values, tag_id: values.tag_id }
    };
  }

  // Transferir Coluna CRM
  const colunaMatch = actionText.match(/\[ADD_ACTION\]:\s*\[pipeline_id:\s*(.*?)\]\s*,\s*\[coluna_id:\s*(.*?)\]\s*,\s*\[card_id:\s*ID_DO_CARD\]\s*,\s*\[contact_id:\s*CONTACT_ID\]/);
  if (colunaMatch) {
    return {
      type: 'transferir_coluna_crm',
      label: 'Transferir Coluna CRM',
      icon: <ArrowRight className="w-3.5 h-3.5" />,
      color: 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700',
      values: { pipeline_id: colunaMatch[1], coluna_id: colunaMatch[2] }
    };
  }

  // Transferir Conexão (agora só exige conection_id)
  if (values.conection_id) {
    return {
      type: 'transferir_conexao',
      label: 'Transferir Conexão',
      icon: <Shuffle className="w-3.5 h-3.5" />,
      color: 'bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700',
      values: { ...values, conection_id: values.conection_id }
    };
  }

  // Transferir Fila (fila_id já é somente ID)
  if (values.fila_id) {
    return {
      type: 'transferir_fila',
      label: 'Transferir Fila',
      icon: <ArrowRightLeft className="w-3.5 h-3.5" />,
      color: 'bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700',
      values: { ...values, fila_id: values.fila_id }
    };
  }

  // Removidos do menu: Criar Card CRM, Salvar Informações Adicionais

  // Enviar Funil (agora só exige funnel_id)
  if (values.funnel_id) {
    return {
      type: 'enviar_funil',
      label: 'Enviar Funil',
      icon: <ListFilter className="w-3.5 h-3.5" />,
      color: 'bg-indigo-100 text-indigo-700 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-700',
      values: { ...values, funnel_id: values.funnel_id }
    };
  }

  // Ação genérica não reconhecida
  return {
    type: 'action_generica',
    label: 'Ação',
    icon: <Database className="w-3.5 h-3.5" />,
    color: 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700',
    values: {}
  };
}

/**
 * Parseia o texto completo e retorna array de ações encontradas
 */
export function parseActionText(text: string): Array<{ match: string; position: number; info: ActionDisplayInfo }> {
  const actions: Array<{ match: string; position: number; info: ActionDisplayInfo }> = [];
  const seenActions = new Set<string>(); // Para evitar duplicatas
  const actionRegex = /\[ADD_ACTION\]:[^\n]*/g;
  let match;

  while ((match = actionRegex.exec(text)) !== null) {
    const actionText = match[0].trim();
    
    // Verificar se já vimos esta ação antes (evitar duplicatas)
    if (seenActions.has(actionText)) {
      continue;
    }
    
    const info = getActionDisplayInfo(actionText);
    
    if (info) {
      seenActions.add(actionText);
      actions.push({
        match: actionText,
        position: match.index,
        info
      });
    }
  }

  return actions;
}

/**
 * Remove ações duplicadas do texto, mantendo apenas a primeira ocorrência de cada ação única
 * Compara ações normalizadas (sem espaços extras) para detectar duplicatas
 */
export function removeDuplicateActions(text: string): string {
  if (!text || !text.includes('[ADD_ACTION]')) {
    return text;
  }

  const actionRegex = /\[ADD_ACTION\]:[^\n]*/g;
  const seenActions = new Map<string, number>(); // Map<normalizedAction, firstIndex>
  const actionPositions: Array<{ text: string; normalized: string; start: number; end: number }> = [];
  let match;

  // Encontrar todas as ações e suas posições
  while ((match = actionRegex.exec(text)) !== null) {
    const actionText = match[0].trim();
    // Normalizar a ação removendo espaços extras entre parâmetros para comparação
    const normalized = actionText.replace(/\s+/g, ' ').trim();
    actionPositions.push({
      text: actionText,
      normalized: normalized,
      start: match.index,
      end: match.index + match[0].length
    });
  }

  // Se não há ações ou apenas uma, retornar o texto original
  if (actionPositions.length <= 1) {
    return text;
  }

  // Identificar ações duplicadas (mesmo texto normalizado)
  const duplicatesToRemove: number[] = [];
  for (let i = 0; i < actionPositions.length; i++) {
    const normalized = actionPositions[i].normalized;
    if (seenActions.has(normalized)) {
      // Esta é uma duplicata, marcar para remoção
      duplicatesToRemove.push(i);
    } else {
      // Primeira ocorrência desta ação, adicionar ao mapa
      seenActions.set(normalized, i);
    }
  }

  // Se não há duplicatas, retornar o texto original
  if (duplicatesToRemove.length === 0) {
    return text;
  }

  // Remover duplicatas do texto (de trás para frente para manter os índices corretos)
  let result = text;
  for (let i = duplicatesToRemove.length - 1; i >= 0; i--) {
    const index = duplicatesToRemove[i];
    const pos = actionPositions[index];
    
    // Extrair partes antes e depois da ação
    const before = result.substring(0, pos.start);
    const after = result.substring(pos.end);
    
    // Remover quebras de linha extras antes e depois, mantendo pelo menos uma se necessário
    const beforeTrimmed = before.replace(/\n+$/, '');
    const afterTrimmed = after.replace(/^\n+/, '');
    
    // Combinar partes, adicionando uma quebra de linha apenas se ambas as partes têm conteúdo
    if (beforeTrimmed && afterTrimmed) {
      result = beforeTrimmed + '\n' + afterTrimmed;
    } else {
      result = beforeTrimmed + afterTrimmed;
    }
  }

  return result;
}



