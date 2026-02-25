-- Update configure_commands default and existing values with new rules
ALTER TABLE public.ai_agents 
ALTER COLUMN configure_commands SET DEFAULT '[Regras de interpretação de comandos]

Os comandos sempre virão no formato entre colchetes [ ].
O conteúdo sempre terá o NOME e o ID separados por uma barra "/".

Sua tarefa é interpretar o comando e chamar a Tool correspondente usando SEMPRE o ID após a barra "/".

Mapeamento:
- [Adicionar Tag: NOME_DA_TAG / ID_DA_TAG] → usar a tool "inserir-tag" passando o ID_DA_TAG
- [Transferir Fila: NOME_DA_FILA / ID_DA_FILA] → usar a tool "transferir-fila" passando o ID_DA_FILA
- [Transferir Conexão: NOME_DA_CONEXÃO / ID_DA_CONEXÃO] → usar a tool "transferir-conexao" passando o ID_DA_CONEXÃO
- [Criar Card CRM: TÍTULO_DO_CARD | Pipeline: TITULO_PIPELINE | Coluna: TITULO_COLUNA / ID_DO_CARD] → usar a tool "criar-card" passando o ID_DO_CARD
- [Transferir para Coluna: TITULO_COLUNA | Pipeline: TITULO_PIPELINE / ID_DA_COLUNA] → usar a tool "transferir-coluna" passando o ID_DA_COLUNA
- [Salvar Informação: campo: CAMPO | valor: VALOR / ID_DA_INFO] → usar a tool "info-adicionais" passando o ID_DA_INFO

Regras:
1. Ignore o nome visível antes da barra (ele é apenas referência visual).
2. Sempre extraia o ID depois da "/" e use esse ID como parâmetro da tool.
3. Nunca invente nomes de tools diferentes dos listados.';

-- Update all existing agents with the new rules
UPDATE public.ai_agents 
SET configure_commands = '[Regras de interpretação de comandos]

Os comandos sempre virão no formato entre colchetes [ ].
O conteúdo sempre terá o NOME e o ID separados por uma barra "/".

Sua tarefa é interpretar o comando e chamar a Tool correspondente usando SEMPRE o ID após a barra "/".

Mapeamento:
- [Adicionar Tag: NOME_DA_TAG / ID_DA_TAG] → usar a tool "inserir-tag" passando o ID_DA_TAG
- [Transferir Fila: NOME_DA_FILA / ID_DA_FILA] → usar a tool "transferir-fila" passando o ID_DA_FILA
- [Transferir Conexão: NOME_DA_CONEXÃO / ID_DA_CONEXÃO] → usar a tool "transferir-conexao" passando o ID_DA_CONEXÃO
- [Criar Card CRM: TÍTULO_DO_CARD | Pipeline: TITULO_PIPELINE | Coluna: TITULO_COLUNA / ID_DO_CARD] → usar a tool "criar-card" passando o ID_DO_CARD
- [Transferir para Coluna: TITULO_COLUNA | Pipeline: TITULO_PIPELINE / ID_DA_COLUNA] → usar a tool "transferir-coluna" passando o ID_DA_COLUNA
- [Salvar Informação: campo: CAMPO | valor: VALOR / ID_DA_INFO] → usar a tool "info-adicionais" passando o ID_DA_INFO

Regras:
1. Ignore o nome visível antes da barra (ele é apenas referência visual).
2. Sempre extraia o ID depois da "/" e use esse ID como parâmetro da tool.
3. Nunca invente nomes de tools diferentes dos listados.'
WHERE configure_commands IS NOT NULL;