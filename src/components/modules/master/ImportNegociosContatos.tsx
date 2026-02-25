import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, CheckCircle2, XCircle, AlertCircle, Download } from 'lucide-react';
import { useImportNegociosContatos, ImportRow } from '@/hooks/useImportNegociosContatos';
import { useToast } from '@/hooks/use-toast';

interface ImportNegociosContatosProps {
  workspaceId: string;
  workspaceName: string;
  onImportComplete?: () => void;
}

export function ImportNegociosContatos({
  workspaceId,
  workspaceName,
  onImportComplete,
}: ImportNegociosContatosProps) {
  const [csvText, setCsvText] = useState<string>('');
  const [previewRows, setPreviewRows] = useState<ImportRow[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isImporting, progress, result, importData, previewCSV } = useImportNegociosContatos();
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione um arquivo CSV.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const text = await file.text();
      setCsvText(text);
      
      // Fazer preview
      const rows = previewCSV(text);
      setPreviewRows(rows);
      setShowPreview(true);
    } catch (error: any) {
      toast({
        title: 'Erro ao ler arquivo',
        description: error.message || 'Não foi possível ler o arquivo CSV.',
        variant: 'destructive',
      });
    }
  };

  const handleImport = async () => {
    if (!csvText) {
      toast({
        title: 'Nenhum arquivo selecionado',
        description: 'Por favor, selecione um arquivo CSV primeiro.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await importData(workspaceId, csvText);
      if (onImportComplete) {
        onImportComplete();
      }
    } catch (error) {
      console.error('Erro na importação:', error);
    }
  };

  const handleDownloadTemplate = () => {
    const template = `Nome,Telefone,Email,Nome do Negócio,Valor,Pipeline,Fase,Tags,Responsável
João Silva,5511999999999,joao@email.com,Venda de Produto X,5000.00,Pipeline Vendas,Qualificação,"Cliente VIP,Novo",João Vendedor
Maria Santos,5511888888888,maria@email.com,Contrato Mensal,1200.00,Pipeline Vendas,Proposta,Ativo,
Pedro Costa,5511777777777,,Serviço Premium,3000.50,Pipeline Vendas,Negociação,"VIP,Urgente",`;

    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'template-importacao-negocios-contatos.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
          Importar Negócios e Contatos
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Importe negócios (cards do kanban) junto com contatos a partir de uma planilha CSV.
        </p>
      </div>

      {/* Card de instruções */}
      <Card className="bg-white dark:bg-[#1f1f1f] border-[#d4d4d4] dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-800 dark:text-gray-200 text-base">
            Instruções
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-400">
            Formato esperado do arquivo CSV
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            <p className="font-semibold mb-2">Colunas obrigatórias:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Nome</strong> - Nome do contato</li>
              <li><strong>Telefone</strong> - Número de telefone (usado para identificar duplicatas)</li>
              <li><strong>Nome do Negócio</strong> - Título do card/negócio</li>
              <li><strong>Valor</strong> - Valor do negócio (numérico)</li>
              <li><strong>Pipeline</strong> - Nome exato da pipeline (deve existir no sistema)</li>
              <li><strong>Fase</strong> - Nome exato da fase/coluna (deve existir na pipeline)</li>
            </ul>
            <p className="font-semibold mt-3 mb-2">Colunas opcionais:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>Email</strong> - Email do contato</li>
              <li><strong>Etiquetas</strong> - Etiquetas separadas por vírgula</li>
              <li><strong>Responsável</strong> - Nome do usuário responsável</li>
            </ul>
          </div>
          <div className="pt-3 border-t border-[#d4d4d4] dark:border-gray-700">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="border-[#d4d4d4] dark:border-gray-700 bg-white dark:bg-[#2d2d2d] text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#3d3d3d]"
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar Template CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upload de arquivo */}
      <Card className="bg-white dark:bg-[#1f1f1f] border-[#d4d4d4] dark:border-gray-700">
        <CardHeader>
          <CardTitle className="text-gray-800 dark:text-gray-200 text-base">
            Selecionar Arquivo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="csv-file" className="text-gray-700 dark:text-gray-300">
                Arquivo CSV
              </Label>
              <Input
                id="csv-file"
                type="file"
                accept=".csv"
                ref={fileInputRef}
                onChange={handleFileSelect}
                disabled={isImporting}
                className="mt-2 bg-white dark:bg-[#2d2d2d] border-[#d4d4d4] dark:border-gray-700 text-gray-800 dark:text-gray-200"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {showPreview && previewRows.length > 0 && (
        <Card className="bg-white dark:bg-[#1f1f1f] border-[#d4d4d4] dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-800 dark:text-gray-200 text-base">
              Preview ({previewRows.length} registros)
            </CardTitle>
            <CardDescription className="text-gray-600 dark:text-gray-400">
              Primeiros registros do arquivo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-[#d4d4d4] dark:border-gray-700">
                    <TableHead className="text-gray-700 dark:text-gray-300">Nome</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300">Telefone</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300">Negócio</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300">Valor</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300">Pipeline</TableHead>
                    <TableHead className="text-gray-700 dark:text-gray-300">Fase</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.slice(0, 5).map((row, index) => (
                    <TableRow key={index} className="border-[#d4d4d4] dark:border-gray-700">
                      <TableCell className="text-gray-800 dark:text-gray-200">{row.nome}</TableCell>
                      <TableCell className="text-gray-800 dark:text-gray-200">{row.telefone}</TableCell>
                      <TableCell className="text-gray-800 dark:text-gray-200">{row.nomeNegocio}</TableCell>
                      <TableCell className="text-gray-800 dark:text-gray-200">{formatCurrency(row.valor)}</TableCell>
                      <TableCell className="text-gray-800 dark:text-gray-200">{row.pipeline}</TableCell>
                      <TableCell className="text-gray-800 dark:text-gray-200">{row.fase}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {previewRows.length > 5 && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Mostrando 5 de {previewRows.length} registros
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Progresso */}
      {isImporting && (
        <Card className="bg-white dark:bg-[#1f1f1f] border-[#d4d4d4] dark:border-gray-700">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">Processando importação...</span>
                <span className="text-gray-600 dark:text-gray-400">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultado */}
      {result && (
        <Card className="bg-white dark:bg-[#1f1f1f] border-[#d4d4d4] dark:border-gray-700">
          <CardHeader>
            <CardTitle className="text-gray-800 dark:text-gray-200 text-base">
              Resultado da Importação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {result.sucessos}
                </div>
                <div className="text-xs text-green-700 dark:text-green-300 mt-1">Sucessos</div>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {result.erros}
                </div>
                <div className="text-xs text-red-700 dark:text-red-300 mt-1">Erros</div>
              </div>
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {result.contatosCriados}
                </div>
                <div className="text-xs text-blue-700 dark:text-blue-300 mt-1">Contatos Criados</div>
              </div>
              <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {result.negociosCriados}
                </div>
                <div className="text-xs text-purple-700 dark:text-purple-300 mt-1">Negócios Criados</div>
              </div>
            </div>

            {result.errosDetalhados.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Erros Detalhados:
                </h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {result.errosDetalhados.map((erro, index) => (
                    <Alert key={index} variant="destructive" className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs">
                        <strong>Linha {erro.linha}:</strong> {erro.erro}
                      </AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Botão de importar */}
      {showPreview && !isImporting && !result && (
        <div className="flex justify-end">
          <Button
            onClick={handleImport}
            disabled={!csvText || previewRows.length === 0}
            className="bg-primary dark:bg-primary text-white hover:bg-primary/90"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importar {previewRows.length} Registros
          </Button>
        </div>
      )}
    </div>
  );
}


