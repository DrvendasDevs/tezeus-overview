-- ===========================================
-- LABORATÓRIO DE IA - Flags para registros de teste
-- ===========================================

-- Adicionar coluna is_lab_test nas tabelas principais
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS is_lab_test BOOLEAN DEFAULT false;

ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS is_lab_test BOOLEAN DEFAULT false;

ALTER TABLE public.pipeline_cards 
ADD COLUMN IF NOT EXISTS is_lab_test BOOLEAN DEFAULT false;

-- Adicionar colunas extras na lab_sessions para armazenar IDs criados
ALTER TABLE public.lab_sessions 
ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS card_id UUID REFERENCES pipeline_cards(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS connection_id UUID REFERENCES connections(id);

-- Índices para filtrar registros de teste
CREATE INDEX IF NOT EXISTS idx_contacts_is_lab_test ON contacts(is_lab_test) WHERE is_lab_test = true;
CREATE INDEX IF NOT EXISTS idx_conversations_is_lab_test ON conversations(is_lab_test) WHERE is_lab_test = true;
CREATE INDEX IF NOT EXISTS idx_pipeline_cards_is_lab_test ON pipeline_cards(is_lab_test) WHERE is_lab_test = true;

-- Comentários
COMMENT ON COLUMN contacts.is_lab_test IS 'Indica se o contato foi criado para testes no Laboratório de IA';
COMMENT ON COLUMN conversations.is_lab_test IS 'Indica se a conversa foi criada para testes no Laboratório de IA';
COMMENT ON COLUMN pipeline_cards.is_lab_test IS 'Indica se o card foi criado para testes no Laboratório de IA';
