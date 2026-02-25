import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceHeaders } from '@/lib/workspaceHeaders';
import { useToast } from '@/hooks/use-toast';

export interface ImportRow {
  nome: string;
  telefone: string;
  email?: string;
  nomeNegocio: string;
  valor: number;
  pipeline: string;
  fase: string;
  tags?: string;
  responsavel?: string;
  linha: number; // Número da linha no CSV para referência de erros
}

export interface ImportResult {
  total: number;
  sucessos: number;
  erros: number;
  duplicados: number;
  contatosCriados: number;
  contatosReutilizados: number;
  negociosCriados: number;
  errosDetalhados: Array<{
    linha: number;
    erro: string;
  }>;
}

export function useImportNegociosContatos() {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const { getHeaders } = useWorkspaceHeaders();
  const { toast } = useToast();

  /**
   * Processa arquivo CSV e retorna array de linhas
   */
  const parseCSV = useCallback((csvText: string): ImportRow[] => {
    const lines = csvText.split('\n').filter((line) => line.trim());
    
    if (lines.length < 2) {
      throw new Error('Arquivo CSV vazio ou inválido');
    }

    // Parse do header
    const headerLine = lines[0];
    const headers = headerLine.split(',').map((h) => h.trim().replace(/"/g, '').toLowerCase());
    
    // Mapear índices das colunas esperadas
    const nomeIndex = headers.findIndex((h) => h === 'nome');
    const telefoneIndex = headers.findIndex((h) => h === 'telefone');
    const emailIndex = headers.findIndex((h) => h === 'email');
    const nomeNegocioIndex = headers.findIndex((h) => h === 'nome do negócio' || h === 'nomedonegocio');
    const valorIndex = headers.findIndex((h) => h === 'valor');
    const pipelineIndex = headers.findIndex((h) => h === 'pipeline');
    const faseIndex = headers.findIndex((h) => h === 'fase');
    const tagsIndex = headers.findIndex((h) => h === 'tags');
    const responsavelIndex = headers.findIndex((h) => h === 'responsável' || h === 'responsavel');

    // Validar colunas obrigatórias
    const requiredColumns = [
      { name: 'Nome', index: nomeIndex },
      { name: 'Telefone', index: telefoneIndex },
      { name: 'Nome do Negócio', index: nomeNegocioIndex },
      { name: 'Valor', index: valorIndex },
      { name: 'Pipeline', index: pipelineIndex },
      { name: 'Fase', index: faseIndex },
    ];

    const missingColumns = requiredColumns
      .filter((col) => col.index === -1)
      .map((col) => col.name);

    if (missingColumns.length > 0) {
      throw new Error(`Colunas obrigatórias não encontradas: ${missingColumns.join(', ')}`);
    }

    // Processar linhas de dados
    const rows: ImportRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse da linha (tratando vírgulas dentro de aspas)
      const values: string[] = [];
      let currentValue = '';
      let insideQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          values.push(currentValue.trim());
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim()); // Último valor

      const nome = values[nomeIndex]?.replace(/"/g, '') || '';
      const telefone = values[telefoneIndex]?.replace(/"/g, '') || '';
      const email = values[emailIndex]?.replace(/"/g, '') || '';
      const nomeNegocio = values[nomeNegocioIndex]?.replace(/"/g, '') || '';
      const valorStr = values[valorIndex]?.replace(/"/g, '').replace(/[^\d,.-]/g, '').replace(',', '.') || '0';
      const valor = parseFloat(valorStr) || 0;
      const pipeline = values[pipelineIndex]?.replace(/"/g, '') || '';
      const fase = values[faseIndex]?.replace(/"/g, '') || '';
      const tags = values[tagsIndex]?.replace(/"/g, '') || '';
      const responsavel = values[responsavelIndex]?.replace(/"/g, '') || '';

      // Validar dados obrigatórios
      if (!nome || !telefone || !nomeNegocio || !pipeline || !fase) {
        continue; // Pular linhas inválidas
      }

      rows.push({
        nome,
        telefone,
        email: email || undefined,
        nomeNegocio,
        valor,
        pipeline,
        fase,
        tags: tags || undefined,
        responsavel: responsavel || undefined,
        linha: i + 1,
      });
    }

    return rows;
  }, []);

  /**
   * Importa negócios e contatos
   */
  const importData = useCallback(async (
    workspaceId: string,
    csvText: string
  ): Promise<ImportResult> => {
    setIsImporting(true);
    setProgress(0);
    setResult(null);

    try {
      // Parse do CSV
      const rows = parseCSV(csvText);
      
      if (rows.length === 0) {
        throw new Error('Nenhuma linha válida encontrada no arquivo');
      }

      // Chamar Edge Function para processar
      const headers = getHeaders(workspaceId);
      
      const { data, error } = await supabase.functions.invoke('import-negocios-contatos', {
        body: {
          workspace_id: workspaceId,
          rows: rows,
        },
        headers,
      });

      if (error) throw error;

      const result: ImportResult = {
        total: rows.length,
        sucessos: data?.sucessos || 0,
        erros: data?.erros || 0,
        duplicados: data?.duplicados || 0,
        contatosCriados: data?.contatos_criados || 0,
        contatosReutilizados: data?.contatos_reutilizados || 0,
        negociosCriados: data?.negocios_criados || 0,
        errosDetalhados: data?.erros_detalhados || [],
      };

      setResult(result);
      setProgress(100);

      toast({
        title: 'Importação concluída',
        description: `${result.sucessos} registros importados com sucesso. ${result.erros > 0 ? `${result.erros} erros encontrados.` : ''}`,
      });

      return result;
    } catch (error: any) {
      console.error('Erro na importação:', error);
      const errorMessage = error?.message || 'Erro ao processar importação';
      
      toast({
        title: 'Erro na importação',
        description: errorMessage,
        variant: 'destructive',
      });

      throw error;
    } finally {
      setIsImporting(false);
    }
  }, [parseCSV, getHeaders, toast]);

  /**
   * Preview do CSV sem importar
   */
  const previewCSV = useCallback((csvText: string): ImportRow[] => {
    try {
      return parseCSV(csvText);
    } catch (error) {
      console.error('Erro ao fazer preview:', error);
      return [];
    }
  }, [parseCSV]);

  return {
    isImporting,
    progress,
    result,
    importData,
    previewCSV,
  };
}


