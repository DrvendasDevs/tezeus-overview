-- Criar tabela Clientes
CREATE TABLE public.clientes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000'::uuid,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Informações básicas do cliente
  nome TEXT NOT NULL,
  email TEXT,
  telefone TEXT,
  cpf_cnpj TEXT,
  tipo_pessoa TEXT NOT NULL DEFAULT 'fisica' CHECK (tipo_pessoa IN ('fisica', 'juridica')),
  
  -- Endereço
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  
  -- Informações comerciais
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'suspenso')),
  data_cadastro TIMESTAMP WITH TIME ZONE DEFAULT now(),
  observacoes TEXT,
  
  -- Metadata adicional
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Habilitar Row Level Security
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- Criar políticas de segurança
CREATE POLICY "clientes_select" 
ON public.clientes 
FOR SELECT 
USING (is_member(org_id));

CREATE POLICY "clientes_insert" 
ON public.clientes 
FOR INSERT 
WITH CHECK (is_member(org_id));

CREATE POLICY "clientes_update" 
ON public.clientes 
FOR UPDATE 
USING (is_member(org_id));

CREATE POLICY "clientes_delete" 
ON public.clientes 
FOR DELETE 
USING (is_master() OR is_member(org_id, 'ADMIN'::org_role));

-- Criar trigger para atualizar updated_at automaticamente
CREATE TRIGGER update_clientes_updated_at
  BEFORE UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Criar índices para melhor performance
CREATE INDEX idx_clientes_org_id ON public.clientes(org_id);
CREATE INDEX idx_clientes_email ON public.clientes(email) WHERE email IS NOT NULL;
CREATE INDEX idx_clientes_telefone ON public.clientes(telefone) WHERE telefone IS NOT NULL;
CREATE INDEX idx_clientes_status ON public.clientes(status);
CREATE INDEX idx_clientes_tipo_pessoa ON public.clientes(tipo_pessoa);