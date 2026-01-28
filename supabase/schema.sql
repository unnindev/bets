-- Schema do banco de dados para o sistema de apostas
-- Execute este SQL no Supabase SQL Editor

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabela de perfis de usuários (extende auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de carteiras
CREATE TABLE IF NOT EXISTS wallets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  balance DECIMAL(12, 2) DEFAULT 0,
  initial_balance DECIMAL(12, 2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de gestores de carteiras
CREATE TABLE IF NOT EXISTS wallet_managers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT CHECK (role IN ('owner', 'manager')) DEFAULT 'manager',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet_id, user_id)
);

-- Tabela de apostas
CREATE TABLE IF NOT EXISTS bets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Jogo
  team_a TEXT NOT NULL,
  team_b TEXT NOT NULL,
  championship TEXT NOT NULL,
  match_date DATE NOT NULL,

  -- Aposta
  bet_type TEXT CHECK (bet_type IN (
    'team_a', 'team_b', 'draw',
    'team_a_or_draw', 'team_b_or_draw', 'team_a_or_team_b',
    'over', 'under', 'both_score_yes', 'both_score_no', 'other'
  )) NOT NULL,
  bet_type_description TEXT,
  amount DECIMAL(12, 2) NOT NULL,
  odds DECIMAL(8, 2) NOT NULL,

  -- Resultado
  result TEXT CHECK (result IN ('win', 'loss', 'draw', 'pending', 'cashout')) DEFAULT 'pending',
  score_team_a INTEGER,
  score_team_b INTEGER,
  return_amount DECIMAL(12, 2) DEFAULT 0,

  -- Metadados
  is_risky BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de transações (depósitos e saques)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  type TEXT CHECK (type IN ('deposit', 'withdraw')) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_bets_wallet_id ON bets(wallet_id);
CREATE INDEX IF NOT EXISTS idx_bets_user_id ON bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_match_date ON bets(match_date);
CREATE INDEX IF NOT EXISTS idx_bets_result ON bets(result);
CREATE INDEX IF NOT EXISTS idx_bets_team_a ON bets(team_a);
CREATE INDEX IF NOT EXISTS idx_bets_team_b ON bets(team_b);
CREATE INDEX IF NOT EXISTS idx_bets_championship ON bets(championship);
CREATE INDEX IF NOT EXISTS idx_wallet_managers_wallet_id ON wallet_managers(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_managers_user_id ON wallet_managers(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet_id ON transactions(wallet_id);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_wallets_updated_at ON wallets;
CREATE TRIGGER update_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_bets_updated_at ON bets;
CREATE TRIGGER update_bets_updated_at
  BEFORE UPDATE ON bets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Função para criar perfil automaticamente quando um usuário se registra
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Trigger para criar perfil ao registrar
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Função para atualizar saldo da carteira após aposta
CREATE OR REPLACE FUNCTION update_wallet_balance_on_bet()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Nova aposta: deduz o valor apostado
    UPDATE wallets
    SET balance = balance - NEW.amount
    WHERE id = NEW.wallet_id;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Se o resultado mudou para win ou cashout, adiciona o retorno
    IF OLD.result = 'pending' AND NEW.result IN ('win', 'cashout') THEN
      UPDATE wallets
      SET balance = balance + NEW.return_amount
      WHERE id = NEW.wallet_id;
    -- Se mudou de win/cashout para pending, remove o retorno
    ELSIF OLD.result IN ('win', 'cashout') AND NEW.result = 'pending' THEN
      UPDATE wallets
      SET balance = balance - OLD.return_amount
      WHERE id = NEW.wallet_id;
    -- Se mudou o retorno em uma aposta já ganha
    ELSIF OLD.result IN ('win', 'cashout') AND NEW.result IN ('win', 'cashout') THEN
      UPDATE wallets
      SET balance = balance - OLD.return_amount + NEW.return_amount
      WHERE id = NEW.wallet_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    -- Aposta deletada: devolve o valor se estava pendente, ou ajusta se já tinha retorno
    IF OLD.result = 'pending' THEN
      UPDATE wallets
      SET balance = balance + OLD.amount
      WHERE id = OLD.wallet_id;
    ELSIF OLD.result IN ('win', 'cashout') THEN
      UPDATE wallets
      SET balance = balance + OLD.amount - OLD.return_amount
      WHERE id = OLD.wallet_id;
    ELSE
      UPDATE wallets
      SET balance = balance + OLD.amount
      WHERE id = OLD.wallet_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Trigger para atualizar saldo
DROP TRIGGER IF EXISTS update_wallet_on_bet ON bets;
CREATE TRIGGER update_wallet_on_bet
  AFTER INSERT OR UPDATE OR DELETE ON bets
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_balance_on_bet();

-- Função para atualizar saldo após transação
CREATE OR REPLACE FUNCTION update_wallet_balance_on_transaction()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'deposit' THEN
      UPDATE wallets
      SET balance = balance + NEW.amount,
          initial_balance = initial_balance + NEW.amount
      WHERE id = NEW.wallet_id;
    ELSE
      UPDATE wallets
      SET balance = balance - NEW.amount
      WHERE id = NEW.wallet_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.type = 'deposit' THEN
      UPDATE wallets
      SET balance = balance - OLD.amount,
          initial_balance = initial_balance - OLD.amount
      WHERE id = OLD.wallet_id;
    ELSE
      UPDATE wallets
      SET balance = balance + OLD.amount
      WHERE id = OLD.wallet_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

-- Trigger para transações
DROP TRIGGER IF EXISTS update_wallet_on_transaction ON transactions;
CREATE TRIGGER update_wallet_on_transaction
  AFTER INSERT OR DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_balance_on_transaction();

-- RLS (Row Level Security) Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Profiles: usuários podem ver todos os perfis, mas só editar o próprio
CREATE POLICY "Profiles são visíveis para usuários autenticados"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários podem editar próprio perfil"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Wallets: apenas gestores podem ver e editar
CREATE POLICY "Gestores podem ver carteiras"
  ON wallets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM wallet_managers
      WHERE wallet_managers.wallet_id = wallets.id
      AND wallet_managers.user_id = auth.uid()
    )
  );

CREATE POLICY "Gestores podem criar carteiras"
  ON wallets FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Owners podem editar carteiras"
  ON wallets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM wallet_managers
      WHERE wallet_managers.wallet_id = wallets.id
      AND wallet_managers.user_id = auth.uid()
      AND wallet_managers.role = 'owner'
    )
  );

CREATE POLICY "Owners podem deletar carteiras"
  ON wallets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM wallet_managers
      WHERE wallet_managers.wallet_id = wallets.id
      AND wallet_managers.user_id = auth.uid()
      AND wallet_managers.role = 'owner'
    )
  );

-- Wallet Managers
CREATE POLICY "Gestores podem ver outros gestores da carteira"
  ON wallet_managers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM wallet_managers wm
      WHERE wm.wallet_id = wallet_managers.wallet_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Owners podem adicionar gestores"
  ON wallet_managers FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM wallet_managers
      WHERE wallet_managers.wallet_id = wallet_managers.wallet_id
      AND wallet_managers.user_id = auth.uid()
      AND wallet_managers.role = 'owner'
    )
    OR NOT EXISTS (
      SELECT 1 FROM wallet_managers
      WHERE wallet_managers.wallet_id = wallet_managers.wallet_id
    )
  );

CREATE POLICY "Owners podem remover gestores"
  ON wallet_managers FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM wallet_managers wm
      WHERE wm.wallet_id = wallet_managers.wallet_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'owner'
    )
  );

-- Bets: gestores podem ver e criar apostas
CREATE POLICY "Gestores podem ver apostas"
  ON bets FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM wallet_managers
      WHERE wallet_managers.wallet_id = bets.wallet_id
      AND wallet_managers.user_id = auth.uid()
    )
  );

CREATE POLICY "Gestores podem criar apostas"
  ON bets FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM wallet_managers
      WHERE wallet_managers.wallet_id = bets.wallet_id
      AND wallet_managers.user_id = auth.uid()
    )
  );

CREATE POLICY "Gestores podem editar apostas"
  ON bets FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM wallet_managers
      WHERE wallet_managers.wallet_id = bets.wallet_id
      AND wallet_managers.user_id = auth.uid()
    )
  );

CREATE POLICY "Gestores podem deletar apostas"
  ON bets FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM wallet_managers
      WHERE wallet_managers.wallet_id = bets.wallet_id
      AND wallet_managers.user_id = auth.uid()
    )
  );

-- Transactions
CREATE POLICY "Gestores podem ver transações"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM wallet_managers
      WHERE wallet_managers.wallet_id = transactions.wallet_id
      AND wallet_managers.user_id = auth.uid()
    )
  );

CREATE POLICY "Gestores podem criar transações"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM wallet_managers
      WHERE wallet_managers.wallet_id = transactions.wallet_id
      AND wallet_managers.user_id = auth.uid()
    )
  );
