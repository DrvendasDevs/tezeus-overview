# Configuração Dinâmica da Base de Dados

Este projeto foi configurado para usar variáveis de ambiente para todas as referências à base de dados, permitindo que você mude facilmente de uma base de dados para outra sem precisar editar código manualmente.

## Variáveis de Ambiente Necessárias

Crie um arquivo `.env` na raiz do projeto com as seguintes variáveis:

```env
# URL do projeto Supabase
# Exemplo: https://seu-projeto-id.supabase.co
VITE_SUPABASE_URL=https://seu-projeto-id.supabase.co

# Chave pública (anon key) do Supabase
# Encontre esta chave no dashboard do Supabase em Settings > API
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

## Como Obter os Valores

1. Acesse o [Dashboard do Supabase](https://supabase.com/dashboard)
2. Selecione seu projeto
3. Vá em **Settings** > **API**
4. Copie:
   - **Project URL** → use como `VITE_SUPABASE_URL`
   - **anon public** key → use como `VITE_SUPABASE_ANON_KEY`

## Arquivos Atualizados

Os seguintes arquivos foram atualizados para usar configuração dinâmica:

### Frontend (src/)
- `src/integrations/supabase/client.ts` - Cliente Supabase
- `src/components/modals/TestWebhookReceptionModal.tsx` - URLs de webhook
- `src/services/EvolutionProvider.ts` - URLs de funções
- `src/components/modules/WhatsAppProvidersConfig.tsx` - Project ID

### Backend (supabase/functions/)
- `supabase/functions/update-all-webhooks-to-v2/index.ts` - URL de webhook

### Configuração Centralizada
- `src/lib/config.ts` - Arquivo centralizado com funções de configuração

## Uso da Configuração

### No Frontend

```typescript
import { config, getSupabaseFunctionUrl } from '@/lib/config';

// Obter URL do Supabase
const supabaseUrl = config.supabase.url;

// Obter Project ID
const projectId = config.supabase.projectId;

// Obter URL de uma função
const functionUrl = getSupabaseFunctionUrl('evolution-webhook-v2');
```

### Nas Funções Supabase (Edge Functions)

As funções Supabase já usam variáveis de ambiente automaticamente:

```typescript
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
```

**Nota:** As variáveis de ambiente nas Edge Functions são configuradas no dashboard do Supabase em **Settings** > **Edge Functions** > **Secrets**.

## Migrando para uma Nova Base de Dados

1. Crie um novo projeto no Supabase (ou use um existente)
2. Atualize o arquivo `.env` com os novos valores
3. Reinicie o servidor de desenvolvimento (`npm run dev`)
4. Para produção, atualize as variáveis de ambiente no seu provedor de hospedagem

## Notas Importantes

- ⚠️ **Nunca commite o arquivo `.env`** no controle de versão
- ✅ O arquivo `.env.example` pode ser commitado como referência
- 🔒 As chaves de serviço (service role keys) nunca devem ser expostas no frontend
- 📝 As migrações SQL históricas podem conter referências hardcoded, mas isso é esperado e não afeta o funcionamento

## Troubleshooting

### Erro: "VITE_SUPABASE_URL não está configurada"

Certifique-se de que:
1. O arquivo `.env` existe na raiz do projeto
2. As variáveis começam com `VITE_` (necessário para o Vite)
3. Você reiniciou o servidor após criar/atualizar o `.env`

### Erro: "Não foi possível extrair o Project ID"

Verifique se a URL do Supabase está no formato correto:
- ✅ Correto: `https://seu-projeto-id.supabase.co`
- ❌ Incorreto: `https://supabase.co/project/seu-projeto-id`

