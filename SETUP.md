# BetTracker - Setup

## 1. Criar projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. Crie um novo projeto
3. Aguarde o projeto ser criado

## 2. Configurar o banco de dados

1. No Supabase, vá em **SQL Editor**
2. Copie e cole todo o conteúdo do arquivo `supabase/schema.sql`
3. Execute o script

## 3. Configurar variáveis de ambiente

1. No Supabase, vá em **Settings > API**
2. Copie a **Project URL** e a **anon public key**
3. Edite o arquivo `.env.local` na raiz do projeto:

```env
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anonima-aqui
```

## 4. Rodar o projeto

```bash
npm install
npm run dev
```

Acesse: http://localhost:3000

## 5. Deploy (Vercel)

1. Faça push do código para o GitHub
2. Acesse [vercel.com](https://vercel.com)
3. Importe o repositório
4. Adicione as variáveis de ambiente:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Deploy!

---

## Estrutura do Projeto

```
/src
  /app
    /login        → Página de login
    /dashboard    → Dashboard com estatísticas
    /bets         → Listagem e cadastro de apostas
    /wallets      → Gestão de carteiras
  /components
    /ui           → Componentes reutilizáveis
    /layout       → Sidebar e layout principal
    /bets         → Componentes específicos de apostas
  /lib
    /supabase     → Configuração do Supabase
    constants.ts  → Constantes e helpers
  /types
    index.ts      → Tipos TypeScript
/supabase
  schema.sql      → Schema do banco de dados
```
