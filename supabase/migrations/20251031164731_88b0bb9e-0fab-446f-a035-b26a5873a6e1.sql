-- Adicionar campo agent_active_id na tabela conversations
ALTER TABLE conversations 
ADD COLUMN agent_active_id uuid REFERENCES ai_agents(id) ON DELETE SET NULL;