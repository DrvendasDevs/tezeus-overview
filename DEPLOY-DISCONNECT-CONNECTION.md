# 🚀 Deploy da função disconnect-connection com verify_jwt = false

## ⚠️ Problema atual
A função está com `verify_jwt: true` no Supabase Cloud, bloqueando requisições CORS antes de chegar ao código.

## ✅ Solução rápida (Dashboard - Recomendado)

1. Acesse o **Supabase Dashboard**: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **Edge Functions**
4. Encontre `disconnect-connection`
5. Clique na função e vá em **Settings** ou **Config**
6. **Desmarque "Verify JWT"** ou configure para `verify_jwt = false`
7. Clique em **Save** ou **Update**
8. A função será atualizada automaticamente

## 🔧 Alternativa: Deploy via CLI

Se você tem o Supabase CLI instalado e linkado:

```bash
supabase functions deploy disconnect-connection --no-verify-jwt
```

OU (se o CLI respeitar o config.toml):

```bash
supabase functions deploy disconnect-connection
```

## ✅ Verificação

Após configurar:
1. Volte ao Dashboard
2. Verifique que "Verify JWT" está **desabilitado**
3. Teste a desconexão na aplicação
4. O erro de CORS deve desaparecer

## 📝 Status atual

- ✅ `config.toml` já tem `verify_jwt = false` configurado
- ✅ Código da função já tem headers CORS corretos
- ❌ Configuração no cloud ainda precisa ser aplicada (fazer via Dashboard)

**Tempo estimado: 2 minutos via Dashboard**

