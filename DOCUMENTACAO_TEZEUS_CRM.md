# Tezeus CRM - Documentação Técnica

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Platform](https://img.shields.io/badge/platform-Supabase-green.svg)
![License](https://img.shields.io/badge/license-Proprietary-red.svg)

**Sistema de CRM completo com integração WhatsApp, automações inteligentes e agentes de IA**

</div>

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Arquitetura do Sistema](#2-arquitetura-do-sistema)
3. [Stack Tecnológico](#3-stack-tecnológico)
4. [Autenticação e Autorização](#4-autenticação-e-autorização)
5. [Estrutura de Dados](#5-estrutura-de-dados)
6. [Módulos do Sistema](#6-módulos-do-sistema)
7. [Integração com N8N](#7-integração-com-n8n)
8. [Integração WhatsApp](#8-integração-whatsapp)
9. [Sistema de Automações](#9-sistema-de-automações)
10. [Agentes de IA](#10-agentes-de-ia)
11. [Edge Functions](#11-edge-functions)
12. [Webhooks e APIs](#12-webhooks-e-apis)
13. [Guia de Implantação](#13-guia-de-implantação)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Visão Geral

### 1.1 Sobre o Tezeus CRM

O Tezeus é um sistema de CRM (Customer Relationship Management) desenvolvido para gestão completa de relacionamento com clientes, integrado nativamente com WhatsApp através de múltiplos provedores (Z-API e Evolution API).

### 1.2 Principais Funcionalidades

| Módulo | Descrição |
|--------|-----------|
| **Pipeline de Negócios** | Gestão visual de oportunidades em formato Kanban |
| **Conversas WhatsApp** | Atendimento centralizado com múltiplas conexões |
| **Automações** | Regras automáticas baseadas em eventos e tempo |
| **Agentes de IA** | Atendimento automatizado com inteligência artificial |
| **Disparador** | Campanhas de mensagens em massa |
| **Relatórios** | Analytics e métricas de desempenho |
| **Multi-tenant** | Suporte a múltiplas empresas (workspaces) |

### 1.3 Arquitetura Multi-tenant

O sistema opera com isolamento por **Workspace**, onde cada workspace representa uma empresa/organização com seus próprios:

- Usuários e permissões
- Conexões WhatsApp
- Pipelines e negócios
- Contatos e conversas
- Automações e agentes

---

## 2. Arquitetura do Sistema

### 2.1 Diagrama de Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CAMADA DE APRESENTAÇÃO                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Master    │  │   Support   │  │    Admin    │  │    User     │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
│         │                │                │                │                │
│         └────────┬───────┴────────────────┴────────┬───────┘                │
│                  │                                 │                        │
│         ┌────────▼────────┐               ┌───────▼────────┐               │
│         │  Central Tezeus │               │    Workspace   │               │
│         │ (Master Dashboard)│             │(Empresa específica)│           │
│         └─────────────────┘               └────────────────┘               │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CAMADA DE APLICAÇÃO                            │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   Comunicação   │  │       CRM       │  │  Configuração   │             │
│  │  (Z-api + N8N)  │  │                 │  │                 │             │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤             │
│  │ • Conversas     │  │ • Pipeline      │  │ • Automações    │             │
│  │ • Disparador    │  │ • Contatos      │  │ • Filas         │             │
│  │ • Msg Rápidas   │  │ • Atividades    │  │ • Conexões      │             │
│  │                 │  │ • Agendas       │  │ • Administração │             │
│  │                 │  │ • Produtos      │  │                 │             │
│  │                 │  │ • Etiquetas     │  │                 │             │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CAMADA DE SERVIÇOS                             │
│                                                                             │
│                    ┌─────────────────────────────────┐                      │
│                    │   Supabase Edge Functions       │                      │
│                    │   (150+ funções serverless)     │                      │
│                    └─────────────────────────────────┘                      │
│                                                                             │
│  Principais funções:                                                        │
│  • manage-system-user      • whatsapp-get-conversations                     │
│  • pipeline-management     • check-message-automations                      │
│  • n8n-response-v2         • disparador-management                          │
│  • evolution-webhook-v2    • execute-agent-action                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CAMADA DE DADOS E INTEGRAÇÕES                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                  Supabase Database (PostgreSQL)                  │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                      │                                      │
│         ┌────────────────────────────┼────────────────────────────┐        │
│         │                            │                            │        │
│         ▼                            ▼                            ▼        │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│  │   WhatsApp APIs │    │  Google Calendar│    │   N8N Webhooks  │        │
│  │ Evolution + Z-API│    │                 │    │                 │        │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Fluxo de Dados

```
                    ┌─────────────┐
                    │   Usuário   │
                    └──────┬──────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                     Frontend (React SPA)                      │
│  • React 18 + TypeScript                                      │
│  • TanStack Query (cache e estado)                           │
│  • React Router (navegação)                                   │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    Supabase Client                            │
│  • Autenticação                                               │
│  • Realtime subscriptions                                     │
│  • Edge Functions calls                                       │
└──────────────────────────────────────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
┌─────────────────────┐    ┌─────────────────────┐
│   Edge Functions    │    │   Database Direct   │
│   (Lógica complexa) │    │   (Queries simples) │
└─────────────────────┘    └─────────────────────┘
              │                         │
              └────────────┬────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    PostgreSQL Database                        │
│  • Row Level Security (RLS)                                   │
│  • Triggers e Functions                                       │
│  • Views otimizadas                                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Stack Tecnológico

### 3.1 Frontend

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| React | 18.x | Framework UI |
| TypeScript | 5.x | Tipagem estática |
| Vite | 5.x | Build tool |
| React Router | 6.x | Roteamento SPA |
| TanStack Query | 5.x | Gerenciamento de estado servidor |
| Tailwind CSS | 3.x | Estilização |
| shadcn/ui | latest | Componentes UI |
| Radix UI | latest | Primitivos acessíveis |
| Lucide React | latest | Ícones |
| date-fns | 3.x | Manipulação de datas |
| Recharts | 2.x | Gráficos |
| React Hook Form | 7.x | Formulários |
| Zod | 3.x | Validação de schemas |

### 3.2 Backend

| Tecnologia | Propósito |
|------------|-----------|
| Supabase | Backend-as-a-Service |
| PostgreSQL | Banco de dados |
| Deno | Runtime Edge Functions |
| Row Level Security | Segurança de dados |

### 3.3 Integrações Externas

| Serviço | Propósito |
|---------|-----------|
| N8N | Orquestração de workflows |
| Z-API | Provider WhatsApp (principal) |
| Evolution API | Provider WhatsApp (descontinuado) |
| Google Calendar | Integração de agendas |
| OpenAI | Agentes de IA |

---

## 4. Autenticação e Autorização

### 4.1 Fluxo de Autenticação

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Login     │────▶│ get-system-user │────▶│  system_users   │
│  (Frontend) │     │ (Edge Function) │     │    (Tabela)     │
└─────────────┘     └─────────────────┘     └─────────────────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Valida senha  │
                    │ (bcrypt hash) │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Cria sessão   │
                    │ Supabase Auth │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │ Retorna user  │
                    │ + JWT token   │
                    └───────────────┘
```

### 4.2 Níveis de Acesso (Roles)

| Role | Descrição | Acesso |
|------|-----------|--------|
| **master** | Administrador global | Central Tezeus + todos os workspaces |
| **support** | Suporte técnico | Central Tezeus + workspaces permitidos |
| **admin** | Gestor da empresa | Workspace específico + configurações |
| **user** | Operador | Workspace específico + operações limitadas |

### 4.3 Hierarquia de Permissões

```
master
  └── support
        └── admin
              └── user
```

### 4.4 Restrições por Role

| Operação | master | support | admin | user |
|----------|:------:|:-------:|:-----:|:----:|
| Criar usuário master | ✅ | ❌ | ❌ | ❌ |
| Criar usuário support | ✅ | ❌ | ❌ | ❌ |
| Criar usuário admin | ✅ | ✅ | ✅ | ❌ |
| Criar usuário user | ✅ | ✅ | ✅ | ❌ |
| Acessar Central Tezeus | ✅ | ✅ | ❌ | ❌ |
| Configurar workspace | ✅ | ✅ | ✅ | ❌ |
| Operar no workspace | ✅ | ✅ | ✅ | ✅ |

---

## 5. Estrutura de Dados

### 5.1 Diagrama ER Simplificado

```
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│  workspaces   │───────│workspace_     │───────│ system_users  │
│               │       │members        │       │               │
└───────────────┘       └───────────────┘       └───────────────┘
        │                                               │
        │                                               │
        ▼                                               │
┌───────────────┐       ┌───────────────┐              │
│  connections  │───────│ conversations │◀─────────────┘
│  (WhatsApp)   │       │               │
└───────────────┘       └───────┬───────┘
                                │
                                ▼
                        ┌───────────────┐
                        │   messages    │
                        └───────────────┘

┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│   contacts    │───────│pipeline_cards │───────│   pipelines   │
│               │       │               │       │               │
└───────────────┘       └───────────────┘       └───────┬───────┘
                                                        │
                                                        ▼
                                                ┌───────────────┐
                                                │pipeline_      │
                                                │columns        │
                                                └───────────────┘
```

### 5.2 Tabelas Principais

#### Workspaces e Usuários

| Tabela | Descrição |
|--------|-----------|
| `workspaces` | Empresas/organizações |
| `workspace_members` | Vínculo usuário-workspace |
| `system_users` | Usuários do sistema |
| `cargos` | Cargos/funções |
| `workspace_limits` | Limites por workspace |

#### Contatos e Comunicação

| Tabela | Descrição |
|--------|-----------|
| `contacts` | Contatos (clientes/leads) |
| `conversations` | Conversas WhatsApp |
| `messages` | Mensagens das conversas |
| `contact_tags` | Tags vinculadas a contatos |
| `contact_observations` | Observações de contatos |

#### Pipeline e CRM

| Tabela | Descrição |
|--------|-----------|
| `pipelines` | Pipelines de vendas |
| `pipeline_columns` | Etapas do pipeline |
| `pipeline_cards` | Negócios/oportunidades |
| `pipeline_card_notes` | Notas dos negócios |
| `activities` | Atividades (tarefas, reuniões) |

#### Conexões e Filas

| Tabela | Descrição |
|--------|-----------|
| `connections` | Conexões WhatsApp |
| `queues` | Filas de atendimento |
| `queue_users` | Usuários das filas |
| `whatsapp_providers` | Provedores configurados |

#### Automações

| Tabela | Descrição |
|--------|-----------|
| `crm_column_automations` | Automações por coluna |
| `crm_column_automation_triggers` | Gatilhos |
| `crm_column_automation_actions` | Ações |
| `ai_agents` | Agentes de IA |
| `automation_executions` | Histórico de execuções |

### 5.3 Views Principais

| View | Propósito |
|------|-----------|
| `system_users_view` | Usuários com dados agregados |
| `pipeline_cards_list_view` | Cards otimizados para listagem |
| `report_pipeline_cards_view` | Cards para relatórios |
| `report_conversations_view` | Conversas para relatórios |
| `audit_logs_view` | Logs de auditoria formatados |

---

## 6. Módulos do Sistema

### 6.1 Conversas WhatsApp

Gerenciamento centralizado de atendimento via WhatsApp.

**Funcionalidades:**
- Visualização de todas as conversas
- Filtros por status, fila, atendente
- Envio de mensagens (texto, áudio, mídia, documentos)
- Transferência entre atendentes/filas
- Ativação de agentes de IA
- Histórico completo de mensagens

**Componentes principais:**
- `src/components/modules/Conversas.tsx`
- `src/hooks/useWhatsAppConversations.ts`
- `src/hooks/useConversationMessages.ts`

### 6.2 Pipeline de Negócios

Gestão visual de oportunidades em formato Kanban.

**Funcionalidades:**
- Múltiplos pipelines por workspace
- Colunas personalizáveis
- Drag-and-drop de cards
- Valores e qualificação
- Automações por coluna
- Histórico de movimentações

**Componentes principais:**
- `src/components/modules/CRMNegocios.tsx`
- `src/hooks/usePipelineCards.ts`
- `src/hooks/usePipelines.ts`

### 6.3 Disparador (Campanhas)

Envio de mensagens em massa para listas de contatos.

**Funcionalidades:**
- Criação de campanhas
- Seleção de contatos por tags
- Variações de mensagens
- Agendamento de envios
- Métricas de entrega e resposta

**Componentes principais:**
- `src/components/modules/Disparador.tsx`
- `supabase/functions/disparador-trigger`

### 6.4 Automações

Sistema de regras automáticas baseadas em eventos.

**Tipos de gatilhos:**
- Entrada em coluna
- Saída de coluna
- Tempo na coluna
- Horário agendado
- Mensagens recebidas

**Tipos de ações:**
- Enviar mensagem
- Enviar funil
- Mover para coluna
- Adicionar tag
- Ativar agente de IA

### 6.5 Agentes de IA

Atendimento automatizado com inteligência artificial.

**Funcionalidades:**
- Configuração de prompts
- Modelos GPT-4 e GPT-4o-mini
- Base de conhecimento
- Horários de funcionamento
- Ações automáticas (tags, transferências)

### 6.6 Relatórios

Analytics e métricas de desempenho.

**Métricas disponíveis:**
- Negócios por etapa
- Conversões
- Tempo médio de atendimento
- Ranking de vendedores
- Performance de agentes

---

## 7. Integração com N8N

### 7.1 Visão Geral

O N8N atua como orquestrador central de workflows, processando mensagens e coordenando ações entre o Tezeus e os provedores WhatsApp.

### 7.2 Arquitetura de Integração

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FLUXO INBOUND                                  │
│                        (Mensagens Recebidas)                                │
│                                                                             │
│  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐             │
│  │  WhatsApp   │───▶│ evolution-      │───▶│   N8N Webhook   │             │
│  │ (Z-API/Evo) │    │ webhook-v2 /    │    │   (Inbound)     │             │
│  └─────────────┘    │ zapi-webhook    │    └────────┬────────┘             │
│                     └─────────────────┘             │                      │
│                                                     ▼                      │
│                                          ┌─────────────────┐               │
│                                          │ N8N Processamento│               │
│                                          │ • Normalização   │               │
│                                          │ • Agentes IA     │               │
│                                          │ • Automações     │               │
│                                          └────────┬────────┘               │
│                                                   │                        │
│                                                   ▼                        │
│                                          ┌─────────────────┐               │
│                                          │ n8n-response-v2 │               │
│                                          │ (Salva mensagem)│               │
│                                          └─────────────────┘               │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              FLUXO OUTBOUND                                 │
│                         (Mensagens Enviadas)                                │
│                                                                             │
│  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐             │
│  │  Frontend   │───▶│ n8n-send-       │───▶│   N8N Webhook   │             │
│  │  (Envio)    │    │ message         │    │   (Outbound)    │             │
│  └─────────────┘    └─────────────────┘    └────────┬────────┘             │
│                                                     │                      │
│                                                     ▼                      │
│                                          ┌─────────────────┐               │
│                                          │ N8N Processamento│               │
│                                          │ • Roteamento     │               │
│                                          │ • Formatação     │               │
│                                          └────────┬────────┘               │
│                                                   │                        │
│                                                   ▼                        │
│                                          ┌─────────────────┐               │
│                                          │   WhatsApp API  │               │
│                                          │  (Z-API/Evolution)│              │
│                                          └─────────────────┘               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Edge Functions de Integração N8N

| Função | Propósito |
|--------|-----------|
| `n8n-response-v2` | Recebe respostas do N8N e salva mensagens |
| `n8n-send-message` | Envia mensagens via N8N |
| `evolution-webhook-v2` | Encaminha webhooks Evolution para N8N |
| `zapi-webhook` | Encaminha webhooks Z-API para N8N |
| `disparador-trigger` | Dispara campanhas via N8N |
| `update-zapi-message-status-from-n8n` | Atualiza status de mensagens |

### 7.4 Payload Inbound (Para N8N)

```typescript
interface InboundPayload {
  event_type: string;              // 'messages.upsert', 'messages.update'
  provider: 'evolution' | 'zapi';
  instance_name: string;
  workspace_id: string;
  connection_id: string;
  contact_phone: string;
  contact_id: string;
  external_id: string;
  status: string;
  timestamp: string;
  webhook_data: object;            // Dados originais do provider
  message_origin: 'external_outside_system' | 'system' | 'ai_agent';
  is_ai_agent: boolean;
  is_system_message: boolean;
  media?: {
    base64?: string;
    fileName: string;
    mimeType: string;
    mediaUrl: string;
    mediaType: string;
  };
}
```

### 7.5 Payload Outbound (Para N8N)

```typescript
interface OutboundPayload {
  event: 'send.message';
  instance: string;
  workspace_id: string;
  connection_id: string;
  conversation_id: string;
  phone_number: string;
  external_id: string;
  provider: 'evolution' | 'zapi';
  data: {
    key: {
      remoteJid: string;
      fromMe: true;
      id: string;
    };
    message: object;
    messageType: string;
    messageTimestamp: number;
  };
  // Credenciais Evolution
  server_url?: string;
  apikey?: string;
  // Credenciais Z-API
  zapi_url?: string;
  zapi_token?: string;
  zapi_client_token?: string;
  zapi_instance_id?: string;
}
```

### 7.6 Payload de Resposta (Do N8N)

```typescript
interface N8NResponsePayload {
  direction: 'inbound' | 'outbound';
  external_id?: string;
  phone_number: string;
  content?: string;
  message_type?: 'text' | 'image' | 'video' | 'audio' | 'document';
  sender_type?: 'contact' | 'agent';
  file_url?: string;
  file_name?: string;
  mime_type?: string;
  workspace_id: string;
  connection_id?: string;
  contact_name?: string;
  reply_to_message_id?: string;
  quoted_message?: object;
  metadata?: object;
  provider_moment?: number;
}
```

### 7.7 Configuração de Webhooks

#### Tabelas de Configuração

| Tabela | Campos | Prioridade |
|--------|--------|------------|
| `workspace_webhook_settings` | `webhook_url`, `webhook_secret` | 1 (Primária) |
| `workspace_webhook_secrets` | `secret_name`, `webhook_url` | 2 (Fallback) |
| `disparador_settings` | `key`, `value` | Específico disparador |
| `whatsapp_providers` | `n8n_webhook_url` | Por provider |

#### Variáveis de Ambiente (Fallbacks)

```env
N8N_INBOUND_WEBHOOK_URL=https://n8n.example.com/webhook/inbound
N8N_WEBHOOK_TOKEN=your-secret-token
DISPARADOR_N8N_WEBHOOK_URL=https://n8n.example.com/webhook/disparador
N8N_FALLBACK_URL=https://n8n.example.com/webhook/fallback
```

### 7.8 Autenticação N8N

| Origem | Header | Valor |
|--------|--------|-------|
| Evolution API | `X-Secret` | `supabase-evolution-webhook` |
| N8N | `Authorization` | `Bearer {N8N_WEBHOOK_TOKEN}` |

---

## 8. Integração WhatsApp

### 8.1 Provedores Suportados

| Provider | Status | Uso Principal |
|----------|--------|---------------|
| **Z-API** | ✅ Ativo | Provider principal |
| **Evolution API** | ⚠️ Descontinuado | Legado (manutenção) |

### 8.2 Fluxo de Conexão

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Tezeus    │────▶│   Criar         │────▶│    Provider     │
│  (Frontend) │     │   Conexão       │     │   (Z-API/Evo)   │
└─────────────┘     └─────────────────┘     └────────┬────────┘
                                                     │
                                                     ▼
                                            ┌─────────────────┐
                                            │   QR Code       │
                                            │   Gerado        │
                                            └────────┬────────┘
                                                     │
                                                     ▼
                                            ┌─────────────────┐
                                            │   WhatsApp      │
                                            │   Escaneia      │
                                            └────────┬────────┘
                                                     │
                                                     ▼
                                            ┌─────────────────┐
                                            │   Conexão       │
                                            │   Estabelecida  │
                                            └─────────────────┘
```

### 8.3 Tipos de Mensagens Suportadas

| Tipo | Envio | Recebimento |
|------|:-----:|:-----------:|
| Texto | ✅ | ✅ |
| Imagem | ✅ | ✅ |
| Vídeo | ✅ | ✅ |
| Áudio | ✅ | ✅ |
| Documento | ✅ | ✅ |
| Sticker | ✅ | ✅ |
| Localização | ❌ | ✅ |
| Contato | ❌ | ✅ |

### 8.4 Status de Mensagens

| Status | Descrição |
|--------|-----------|
| `sending` | Enviando para o provider |
| `sent` | Enviado ao WhatsApp |
| `delivered` | Entregue ao destinatário |
| `read` | Lido pelo destinatário |
| `failed` | Falha no envio |

---

## 9. Sistema de Automações

### 9.1 Arquitetura de Automações

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SISTEMA DE AUTOMAÇÕES                             │
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │    TRIGGERS     │───▶│   CONDITIONS    │───▶│    ACTIONS      │         │
│  │   (Gatilhos)    │    │   (Condições)   │    │    (Ações)      │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                             │
│  Triggers:                                      Actions:                    │
│  • enter_column         Conditions:             • send_message              │
│  • leave_column         • Horário comercial     • send_funnel               │
│  • time_in_column       • Dias da semana        • move_to_column            │
│  • scheduled_time       • Status do card        • add_tag                   │
│  • message_received     • Agente ativo          • add_agent                 │
│                                                 • remove_agent              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Tipos de Triggers

#### `enter_column`
Executado quando um card entra em uma coluna.

```typescript
{
  trigger_type: 'enter_column',
  // Executa imediatamente ao entrar
}
```

#### `leave_column`
Executado quando um card sai de uma coluna.

```typescript
{
  trigger_type: 'leave_column',
  // Executa imediatamente ao sair
}
```

#### `time_in_column`
Executado após um tempo específico na coluna.

```typescript
{
  trigger_type: 'time_in_column',
  time_value: 30,
  time_unit: 'minutes' // 'seconds' | 'minutes' | 'hours' | 'days'
}
```

#### `scheduled_time`
Executado em horário específico.

```typescript
{
  trigger_type: 'scheduled_time',
  scheduled_time: '09:00',
  timezone: 'America/Sao_Paulo',
  days_of_week: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
}
```

#### `message_received`
Executado após N mensagens recebidas.

```typescript
{
  trigger_type: 'message_received',
  message_count: 3 // Após 3 mensagens do contato
}
```

### 9.3 Tipos de Actions

#### `send_message`
Envia uma mensagem para o contato.

```typescript
{
  action_type: 'send_message',
  message_variations: [
    'Olá {{nome}}, tudo bem?',
    'Oi {{nome}}! Como posso ajudar?'
  ],
  connection_mode: 'default' // 'default' | 'last' | 'specific'
}
```

**Variáveis disponíveis:**
- `{{nome}}` - Nome do contato
- `{{telefone}}` - Telefone do contato
- `{{etapa}}` - Nome da coluna atual
- `{{responsavel}}` - Nome do responsável
- `{{valor}}` - Valor do negócio

#### `send_funnel`
Envia um funil completo (sequência de mensagens).

```typescript
{
  action_type: 'send_funnel',
  funnel_id: 'uuid-do-funil'
}
```

#### `move_to_column`
Move o card para outra coluna.

```typescript
{
  action_type: 'move_to_column',
  target_column_id: 'uuid-da-coluna',
  target_pipeline_id?: 'uuid-do-pipeline' // Opcional
}
```

#### `add_tag`
Adiciona uma tag ao contato.

```typescript
{
  action_type: 'add_tag',
  tag_id: 'uuid-da-tag'
}
```

#### `add_agent` / `remove_agent`
Ativa ou desativa agente de IA na conversa.

```typescript
{
  action_type: 'add_agent',
  agent_id: 'uuid-do-agente'
}
```

### 9.4 Fluxo de Execução

```
┌─────────────┐
│   Evento    │
│  Detectado  │
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│  Verifica   │────▶│  Já foi     │──── Sim ───▶ FIM
│  Execução   │     │  executado? │
└─────────────┘     └──────┬──────┘
                           │ Não
                           ▼
                   ┌─────────────┐
                   │  Verifica   │──── Fora ───▶ FIM
                   │  Horário    │
                   │  Comercial  │
                   └──────┬──────┘
                          │ Dentro
                          ▼
                   ┌─────────────┐
                   │  Registra   │
                   │  Execução   │
                   └──────┬──────┘
                          │
                          ▼
                   ┌─────────────┐
                   │  Executa    │
                   │  Ações      │
                   └──────┬──────┘
                          │
                          ▼
                   ┌─────────────┐
                   │  Anti-spam  │
                   │  (delays)   │
                   └─────────────┘
```

### 9.5 Proteções Implementadas

| Proteção | Descrição |
|----------|-----------|
| **Deduplicação** | UUID determinístico por execução |
| **Anti-spam** | Delay de 3s entre automações, 2s entre mensagens |
| **Horário comercial** | Verifica `workspace_business_hours` |
| **Lock** | Registro antes da execução (race conditions) |

---

## 10. Agentes de IA

### 10.1 Visão Geral

Os agentes de IA são assistentes virtuais que respondem automaticamente às mensagens dos contatos usando modelos de linguagem (OpenAI).

### 10.2 Configuração do Agente

```typescript
interface AIAgent {
  id: string;
  name: string;
  description: string;
  model: 'gpt-4o' | 'gpt-4o-mini';
  temperature: number;        // 0.0 - 2.0
  max_tokens: number;
  system_instructions: string;
  process_messages: boolean;  // Interpretar comandos
  knowledge_base_enabled: boolean;
  working_hours_enabled: boolean;
  working_days: string[];
  fallback_message: string;
}
```

### 10.3 Fluxo de Processamento

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FLUXO DO AGENTE DE IA                                │
│                                                                             │
│  ┌─────────────┐    ┌─────────────────┐    ┌─────────────────┐             │
│  │  Mensagem   │───▶│ Agente Ativo?   │───▶│ Busca Histórico │             │
│  │  Recebida   │    │ (agente_ativo)  │    │ (últimas msgs)  │             │
│  └─────────────┘    └─────────────────┘    └────────┬────────┘             │
│                                                     │                      │
│                                                     ▼                      │
│                                          ┌─────────────────┐               │
│                                          │  OpenAI API     │               │
│                                          │  (GPT-4)        │               │
│                                          └────────┬────────┘               │
│                                                   │                        │
│                                                   ▼                        │
│                                          ┌─────────────────┐               │
│                                          │ process_messages│               │
│                                          │ = true?         │               │
│                                          └────────┬────────┘               │
│                                                   │                        │
│                              ┌────────────────────┴────────────────────┐   │
│                              │                                         │   │
│                              ▼                                         ▼   │
│                     ┌─────────────────┐                      ┌─────────────┐
│                     │ Extrai Comandos │                      │   Envia     │
│                     │ (JSON/[TOOL])   │                      │  Resposta   │
│                     └────────┬────────┘                      └─────────────┘
│                              │                                             │
│                              ▼                                             │
│                     ┌─────────────────┐                                    │
│                     │execute-agent-   │                                    │
│                     │action           │                                    │
│                     └─────────────────┘                                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 10.4 Ações Disponíveis

| Ação | Descrição | Formato |
|------|-----------|---------|
| `add-tag` | Adicionar tag ao contato | `{"action":"add_tag","tagId":"UUID"}` |
| `transfer-queue` | Transferir para fila | `{"action":"transfer_queue","queueId":"UUID"}` |
| `transfer-connection` | Transferir conexão | `{"action":"transfer_connection","connectionId":"UUID"}` |
| `create-card` | Criar card no pipeline | `{"action":"create_card","pipelineId":"UUID","columnId":"UUID"}` |
| `transfer-column` | Mover card de coluna | `{"action":"transfer_column","columnId":"UUID"}` |
| `save-info` | Salvar informação extra | `{"action":"save_info","field":"email","value":"x@y.com"}` |

### 10.5 Exemplo de Prompt

```markdown
Você é um assistente de vendas da empresa XYZ.

## Suas responsabilidades:
1. Responder dúvidas sobre produtos
2. Agendar demonstrações
3. Qualificar leads

## Quando qualificar um lead:
- Pergunte: nome, empresa, cargo, necessidade
- Se qualificado, adicione a tag "Qualificado"
- Use: {"action":"add_tag","tagId":"uuid-tag-qualificado"}

## Quando precisar de um humano:
- Transfira para a fila de vendas
- Use: {"action":"transfer_queue","queueId":"uuid-fila-vendas"}

## Informações da empresa:
- Produto: Software de CRM
- Preço: A partir de R$ 99/mês
- Teste grátis: 14 dias
```

---

## 11. Edge Functions

### 11.1 Categorias de Funções

#### Autenticação e Usuários

| Função | Propósito |
|--------|-----------|
| `get-system-user` | Autenticar usuário (login) |
| `manage-system-user` | CRUD de usuários |
| `list-user-workspaces` | Listar workspaces do usuário |
| `manage-workspace-members` | Gerenciar membros |

#### Conversas e Mensagens

| Função | Propósito |
|--------|-----------|
| `whatsapp-get-conversations` | Buscar conversas |
| `whatsapp-get-messages` | Buscar mensagens |
| `send-whatsapp-message` | Enviar mensagem |
| `accept-conversation` | Aceitar conversa |
| `assign-conversation` | Atribuir conversa |
| `end-conversation` | Encerrar conversa |

#### Pipeline

| Função | Propósito |
|--------|-----------|
| `pipeline-management` | Gerenciar pipeline |
| `auto-create-pipeline-card` | Criar card automático |
| `sync-pipeline-cards` | Sincronizar cards |

#### Automações

| Função | Propósito |
|--------|-----------|
| `check-message-automations` | Verificar automações de mensagem |
| `check-time-based-automations` | Automações baseadas em tempo |
| `execute-agent-action` | Executar ação do agente |
| `ai-chat-response` | Processar resposta do agente |

#### Webhooks e Integrações

| Função | Propósito |
|--------|-----------|
| `evolution-webhook-v2` | Webhook Evolution API |
| `zapi-webhook` | Webhook Z-API |
| `n8n-response-v2` | Resposta do N8N |
| `n8n-send-message` | Enviar via N8N |

### 11.2 Estrutura Padrão

```typescript
// supabase/functions/nome-da-funcao/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Inicializar Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Lógica da função
    const body = await req.json();
    
    // ... processamento ...

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
```

---

## 12. Webhooks e APIs

### 12.1 Webhooks Recebidos

#### Evolution API Webhook

**Endpoint:** `/functions/v1/evolution-webhook-v2`

**Headers:**
```
X-Secret: supabase-evolution-webhook
Content-Type: application/json
```

**Eventos suportados:**
- `messages.upsert` - Nova mensagem
- `messages.update` - Atualização de status
- `connection.update` - Status da conexão
- `qrcode.updated` - QR Code atualizado

#### Z-API Webhook

**Endpoint:** `/functions/v1/zapi-webhook`

**Headers:**
```
Content-Type: application/json
```

**Eventos suportados:**
- `ReceivedCallback` - Mensagem recebida
- `MessageStatusCallback` - Status da mensagem
- `DisconnectedCallback` - Desconexão

### 12.2 API Externa (Workspace API Keys)

O sistema permite que workspaces criem chaves de API para integrações externas.

**Autenticação:**
```
Authorization: Bearer {workspace_api_key}
```

**Endpoints disponíveis:**
- `POST /functions/v1/external-webhook-api` - Webhook genérico

---

## 13. Guia de Implantação

### 13.1 Requisitos

- Node.js 18+
- Conta Supabase
- Conta N8N (self-hosted ou cloud)
- Conta Z-API ou Evolution API
- Conta OpenAI (para agentes IA)

### 13.2 Variáveis de Ambiente

#### Frontend (.env)

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

#### Supabase Edge Functions

```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# N8N
N8N_INBOUND_WEBHOOK_URL=https://n8n.example.com/webhook/inbound
N8N_WEBHOOK_TOKEN=your-n8n-token

# OpenAI
OPENAI_API_KEY=sk-xxx

# WhatsApp Providers
EVOLUTION_API_URL=https://evolution.example.com
ZAPI_BASE_URL=https://api.z-api.io
```

### 13.3 Deploy Frontend

```bash
# Instalar dependências
npm install

# Build de produção
npm run build

# Deploy (exemplo: Vercel)
vercel deploy --prod
```

### 13.4 Deploy Edge Functions

```bash
# Login no Supabase CLI
supabase login

# Link ao projeto
supabase link --project-ref xxx

# Deploy de todas as funções
supabase functions deploy

# Deploy de função específica
supabase functions deploy nome-da-funcao
```

### 13.5 Configuração N8N

1. **Criar workflows** para:
   - Processamento de mensagens inbound
   - Envio de mensagens outbound
   - Processamento de agentes IA

2. **Configurar webhooks** no N8N:
   - Webhook inbound: recebe do Tezeus
   - Webhook outbound: envia para provider

3. **Configurar credenciais**:
   - Z-API ou Evolution API
   - Supabase (para callbacks)

---

## 14. Troubleshooting

### 14.1 Problemas Comuns

#### Erro 403 ao criar usuário

**Causa:** Header `x-system-user-id` não está sendo enviado.

**Solução:** Verificar se o hook `useSystemUsers` está enviando os headers corretamente.

#### Mensagens não chegam

**Verificar:**
1. Status da conexão WhatsApp
2. Logs do webhook (Evolution/Z-API)
3. Logs do N8N
4. Configuração de webhook no workspace

#### Automação não executa

**Verificar:**
1. Automação está ativa
2. Horário comercial configurado
3. Card está na coluna correta
4. Logs em `automation_executions`

#### Agente não responde

**Verificar:**
1. `agente_ativo = true` na conversa
2. `agent_active_id` configurado
3. Chave OpenAI válida
4. Logs do `ai-chat-response`

### 14.2 Logs e Debugging

#### Logs do Supabase

```bash
# Ver logs de função específica
supabase functions logs nome-da-funcao --tail

# Ver todos os logs
supabase logs --tail
```

#### Logs do Frontend

```javascript
// Ativar logs detalhados
localStorage.setItem('debug', 'true');
```

### 14.3 Monitoramento

| Métrica | Onde verificar |
|---------|---------------|
| Edge Functions | Supabase Dashboard > Edge Functions |
| Database | Supabase Dashboard > Database > Query Performance |
| N8N | N8N Dashboard > Executions |
| WhatsApp | Z-API/Evolution Dashboard |

---

## Apêndices

### A. Glossário

| Termo | Definição |
|-------|-----------|
| **Workspace** | Espaço isolado de uma empresa no sistema |
| **Pipeline** | Fluxo de vendas com colunas/etapas |
| **Card** | Negócio/oportunidade no pipeline |
| **Conversa** | Thread de mensagens com um contato |
| **Conexão** | Instância WhatsApp conectada |
| **Fila** | Grupo de atendimento para distribuição |
| **Agente** | Assistente de IA para atendimento automático |
| **Funil** | Sequência de mensagens automáticas |

### B. Referências

- [Supabase Documentation](https://supabase.com/docs)
- [N8N Documentation](https://docs.n8n.io)
- [Z-API Documentation](https://developer.z-api.io)
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)

---

<div align="center">

**Tezeus CRM** - Documentação Técnica v1.0

Última atualização: Fevereiro 2026

</div>
