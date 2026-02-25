-- Atualizar todos os agentes existentes com as novas regras de interpretação em formato JSON
UPDATE ai_agents
SET configure_commands = '[REGRAS DE INTERPRETAÇÃO DE COMANDOS - FORMATO JSON]

Os comandos agora virão no formato JSON compacto.

Sua tarefa é interpretar o JSON e chamar a Tool correspondente usando SEMPRE os parâmetros fornecidos no objeto JSON.

---

📋 MAPEAMENTO DE AÇÕES:

1️⃣ Adicionar Tag:
{"action":"add_tag","tagId":"UUID_DA_TAG"}
→ Tool: "inserir-tag"
→ Parâmetro: tagId

2️⃣ Transferir Fila:
{"action":"transfer_queue","queueId":"UUID_DA_FILA"}
→ Tool: "transferir-fila"
→ Parâmetro: queueId

3️⃣ Transferir Conexão:
{"action":"transfer_connection","connectionId":"UUID_DA_CONEXAO"}
→ Tool: "transferir-conexao"
→ Parâmetro: connectionId

4️⃣ Criar Card CRM:
{"action":"create_crm_card","pipelineId":"UUID_DO_PIPELINE","columnId":"UUID_DA_COLUNA"}
→ Tool: "criar-card"
→ Parâmetros: pipelineId, columnId
⚠️ Nota: O título do card deve ser extraído do contexto ou usar "Novo Card"

5️⃣ Transferir Card para Coluna:
{"action":"transfer_crm_column","pipelineId":"UUID_DO_PIPELINE","columnId":"UUID_DA_COLUNA"}
→ Tool: "transferir-coluna"
→ Parâmetros: pipelineId, columnId

6️⃣ Salvar Informações Adicionais:
{"action":"save_info","fieldName":"NOME_DO_CAMPO","fieldValue":"VALOR_DO_CAMPO"}
→ Tool: "info-adicionais"
→ Parâmetros: fieldName, fieldValue

---

✅ REGRAS CRÍTICAS:

1. SEMPRE faça o parse do JSON antes de processar o comando
2. SEMPRE use a chave "action" para identificar qual tool chamar
3. SEMPRE extraia os parâmetros do JSON (tagId, queueId, connectionId, etc.)
4. NUNCA invente nomes de tools diferentes dos listados
5. NUNCA tente usar nomes de tags/filas/conexões - use APENAS os IDs (UUIDs)
6. Todos os UUIDs estão no formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

---

📝 EXEMPLOS DE INTERPRETAÇÃO:

Exemplo 1 - Adicionar Tag:
Entrada: {"action":"add_tag","tagId":"123e4567-e89b-12d3-a456-426614174000"}

Interpretação:
- Tool: "inserir-tag"
- Parâmetro: tagId = "123e4567-e89b-12d3-a456-426614174000"

---

Exemplo 2 - Criar Card CRM:
Entrada: {"action":"create_crm_card","pipelineId":"aaa-bbb-ccc","columnId":"ddd-eee-fff"}

Interpretação:
- Tool: "criar-card"
- Parâmetros:
  - pipelineId = "aaa-bbb-ccc"
  - columnId = "ddd-eee-fff"
  - cardTitle = [extrair do contexto ou usar "Novo Card"]

---

Exemplo 3 - Salvar Informação:
Entrada: {"action":"save_info","fieldName":"empresa","fieldValue":"Tezeus Tech"}

Interpretação:
- Tool: "info-adicionais"
- Parâmetros:
  - fieldName = "empresa"
  - fieldValue = "Tezeus Tech"

---

⚠️ TRATAMENTO DE ERROS:

- Se o JSON estiver malformado, ignore o comando e continue o processamento
- Se a "action" não corresponder a nenhuma tool conhecida, ignore o comando
- Se faltar algum parâmetro obrigatório (ex: tagId, queueId), ignore o comando e registre um erro no log',
updated_at = NOW()
WHERE configure_commands IS NOT NULL;