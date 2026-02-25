-- Atualizar configure_commands de todos os agentes existentes para o novo formato de colchetes
UPDATE ai_agents 
SET configure_commands = '[REGRAS DE INTERPRETAÇÃO DE COMANDOS - FORMATO COLCHETES]

Os comandos agora virão no formato de colchetes com instruções claras para o agente.

Sua tarefa é interpretar os comandos no formato especificado abaixo e executar as ações correspondentes.

---

📋 MAPEAMENTO DE AÇÕES:

1️⃣ Adicionar Tag:
Formato: [ENVIE PARA O TOOL `inserir-tag` (METODO POST) o id: UUID_DA_TAG]
Exemplo: [ENVIE PARA O TOOL `inserir-tag` (METODO POST) o id: 123e4567-e89b-12d3-a456-426614174000]

2️⃣ Transferir Fila:
Formato: [ENVIE PARA O TOOL `transferir-fila` (METODO POST) o id: UUID_DA_FILA]
Exemplo: [ENVIE PARA O TOOL `transferir-fila` (METODO POST) o id: 456e7890-e89b-12d3-a456-426614174111]

3️⃣ Transferir Conexão:
Formato: [ENVIE PARA O TOOL `transferir-conexao` (METODO POST) o id: UUID_DA_CONEXAO]
Exemplo: [ENVIE PARA O TOOL `transferir-conexao` (METODO POST) o id: 789e0123-e89b-12d3-a456-426614174222]

4️⃣ Criar Card CRM:
Formato: [ENVIE PARA O TOOL `criar-card` (METODO POST) o pipeline_id: UUID_DO_PIPELINE e a coluna_id: UUID_DA_COLUNA]
Formato com título: [ENVIE PARA O TOOL `criar-card` (METODO POST) o pipeline_id: UUID_DO_PIPELINE e a coluna_id: UUID_DA_COLUNA com o title TÍTULO_DO_CARD]
Exemplo: [ENVIE PARA O TOOL `criar-card` (METODO POST) o pipeline_id: abc-123-def e a coluna_id: ghi-456-jkl com o title Novo Lead]

5️⃣ Transferir Card para Coluna (CRM):
Formato: [ENVIE PARA O TOOL `transferir-coluna` (METODO POST) o pipeline_id: UUID_DO_PIPELINE e a coluna_id: UUID_DA_COLUNA]
Exemplo: [ENVIE PARA O TOOL `transferir-coluna` (METODO POST) o pipeline_id: abc-123-def e a coluna_id: xyz-789-uvw]

6️⃣ Transferir Coluna do CRM (genérico):
Formato: [ENVIE PARA O TOOL `transferir-coluna` (METODO POST) movendo o card atual para a coluna_id: UUID_DA_COLUNA dentro do pipeline_id: UUID_DO_PIPELINE]
Exemplo: [ENVIE PARA O TOOL `transferir-coluna` (METODO POST) movendo o card atual para a coluna_id: xyz-789-uvw dentro do pipeline_id: abc-123-def]

7️⃣ Salvar Informações Adicionais:
Formato: [ENVIE PARA O TOOL `info-adicionais` (METODO POST) o id: UUID_DA_INFO e o valor VALOR_CORRESPONDENTE]
Exemplo: [ENVIE PARA O TOOL `info-adicionais` (METODO POST) o id: campo-empresa e o valor Tezeus Tech]

---

✅ REGRAS CRÍTICAS:

1. NUNCA use JSON novamente
2. SEMPRE escreva os comandos nesse formato de colchetes
3. NUNCA misture texto conversacional com comandos
4. SEMPRE utilize IDs reais (UUIDs)
5. Se faltar parâmetro obrigatório, ignore a ação
6. Todos os UUIDs estão no formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
7. Use backticks (`) para envolver os nomes das tools
8. Escreva METODO POST em maiúsculas
9. Use "o id:", "o pipeline_id:", "a coluna_id:", "o valor" conforme especificado

---

⚠️ TRATAMENTO DE ERROS:

- Se o formato do comando estiver incorreto, ignore o comando e continue o processamento
- Se o UUID não estiver no formato correto, ignore o comando
- Se faltar algum parâmetro obrigatório, ignore o comando e registre um erro no log
- NUNCA tente executar comandos com IDs inválidos ou inexistentes'
WHERE configure_commands IS NOT NULL 
   OR configure_commands LIKE '%FORMATO JSON%'
   OR configure_commands LIKE '%{"action"%';