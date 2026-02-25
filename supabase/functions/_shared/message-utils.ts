/**
 * Utilitários compartilhados para automações de mensagem.
 * Usado por: pipeline-management, check-time-based-automations,
 *            check-birthday-automations, check-seasonal-automations
 */

/**
 * Seleciona aleatoriamente entre a mensagem principal e variações.
 * Suporta dois formatos de entrada:
 *   1. actionConfig object (pipeline-management, time-based)
 *   2. mainMessage + variations separados (birthday, seasonal)
 */
export function selectMessageVariation(
  mainMessageOrConfig: string | { message?: string; message_variations?: string[] },
  variations?: string[]
): string {
  let mainMessage: string;
  let messageVariations: string[];

  if (typeof mainMessageOrConfig === 'string') {
    mainMessage = mainMessageOrConfig;
    messageVariations = Array.isArray(variations)
      ? variations.filter((v: string) => v && v.trim())
      : [];
  } else {
    mainMessage = mainMessageOrConfig?.message || '';
    messageVariations = Array.isArray(mainMessageOrConfig?.message_variations)
      ? mainMessageOrConfig.message_variations.filter((v: string) => v && v.trim())
      : [];
  }

  if (messageVariations.length === 0) return mainMessage;

  const allMessages = [mainMessage, ...messageVariations].filter(Boolean);
  return allMessages[Math.floor(Math.random() * allMessages.length)];
}

/**
 * Substitui variáveis de template pelos dados reais.
 * Suporta todas as variáveis: nome, primeiro_nome, telefone, email,
 *                              etapa, pipeline, data_comemorativa
 */
export function replaceMessageVariables(
  message: string,
  contact?: { name?: string; phone?: string; email?: string } | null,
  extraVars?: {
    columnName?: string;
    pipelineName?: string;
    seasonalDateName?: string;
  }
): string {
  if (!message) return message;

  let result = message
    .replace(/\{\{nome\}\}/gi, contact?.name || '')
    .replace(/\{\{primeiro_nome\}\}/gi, (contact?.name || '').split(' ')[0] || '')
    .replace(/\{\{telefone\}\}/gi, contact?.phone || '')
    .replace(/\{\{email\}\}/gi, contact?.email || '');

  if (extraVars?.columnName !== undefined) {
    result = result.replace(/\{\{etapa\}\}/gi, extraVars.columnName || '');
  }
  if (extraVars?.pipelineName !== undefined) {
    result = result.replace(/\{\{pipeline\}\}/gi, extraVars.pipelineName || '');
  }
  if (extraVars?.seasonalDateName !== undefined) {
    result = result.replace(/\{\{data_comemorativa\}\}/gi, extraVars.seasonalDateName || '');
  }

  return result;
}
