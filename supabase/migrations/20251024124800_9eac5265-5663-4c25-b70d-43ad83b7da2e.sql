-- Add configure_commands column to ai_agents table
ALTER TABLE public.ai_agents 
ADD COLUMN configure_commands TEXT DEFAULT '[Regras de interpretação de comandos]

Os comandos sempre virão no formato entre colchetes [ ].

Sua tarefa é interpretar o comando e chamar a Tool correspondente:

- Se encontrar [Adicionar Tag: ...] → usar a tool "inserir-tag"
- Se encontrar [Transferir Fila: ...] → usar a tool "transferir-fila"
- Se encontrar [Transferir Conexão: ...] → usar a tool "transferir-conexão"
- Se encontrar [Criar Card CRM: ...] → usar a tool "criar-card"
- Se encontrar [Transferir para Coluna: ...] → usar a tool "transferir-coluna"
- Se encontrar [Salvar Informação: ...] → usar a tool "info-adicionais"

Sempre extraia os parâmetros do texto dentro dos colchetes e passe para a tool correta.
Não invente novos nomes de tool, use apenas os definidos acima.';

-- Update existing agents to have the default value
UPDATE public.ai_agents 
SET configure_commands = '[Regras de interpretação de comandos]

Os comandos sempre virão no formato entre colchetes [ ].

Sua tarefa é interpretar o comando e chamar a Tool correspondente:

- Se encontrar [Adicionar Tag: ...] → usar a tool "inserir-tag"
- Se encontrar [Transferir Fila: ...] → usar a tool "transferir-fila"
- Se encontrar [Transferir Conexão: ...] → usar a tool "transferir-conexão"
- Se encontrar [Criar Card CRM: ...] → usar a tool "criar-card"
- Se encontrar [Transferir para Coluna: ...] → usar a tool "transferir-coluna"
- Se encontrar [Salvar Informação: ...] → usar a tool "info-adicionais"

Sempre extraia os parâmetros do texto dentro dos colchetes e passe para a tool correta.
Não invente novos nomes de tool, use apenas os definidos acima.'
WHERE configure_commands IS NULL;