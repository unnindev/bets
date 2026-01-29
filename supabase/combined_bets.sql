-- Tabela de apostas combinadas
CREATE TABLE IF NOT EXISTS combined_bets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Aposta
  amount DECIMAL(12, 2) NOT NULL,
  odds DECIMAL(8, 2) NOT NULL,

  -- Resultado
  result TEXT CHECK (result IN ('win', 'loss', 'pending', 'cashout')) DEFAULT 'pending',
  return_amount DECIMAL(12, 2) DEFAULT 0,

  -- Metadados
  is_risky BOOLEAN DEFAULT FALSE,
  notes TEXT,
  match_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de jogos dentro de uma aposta combinada
CREATE TABLE IF NOT EXISTS combined_bet_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  combined_bet_id UUID REFERENCES combined_bets(id) ON DELETE CASCADE NOT NULL,

  -- Jogo
  team_a TEXT NOT NULL,
  team_b TEXT NOT NULL,
  championship TEXT NOT NULL,
  bet_type TEXT CHECK (bet_type IN (
    'team_a', 'team_b', 'draw',
    'team_a_or_draw', 'team_b_or_draw', 'team_a_or_team_b',
    'over', 'under', 'both_score_yes', 'both_score_no', 'other'
  )) NOT NULL,
  bet_type_description TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Desabilitar RLS
ALTER TABLE combined_bets DISABLE ROW LEVEL SECURITY;
ALTER TABLE combined_bet_items DISABLE ROW LEVEL SECURITY;

-- Índices
CREATE INDEX IF NOT EXISTS idx_combined_bets_wallet_id ON combined_bets(wallet_id);
CREATE INDEX IF NOT EXISTS idx_combined_bets_match_date ON combined_bets(match_date);
CREATE INDEX IF NOT EXISTS idx_combined_bets_result ON combined_bets(result);
CREATE INDEX IF NOT EXISTS idx_combined_bet_items_combined_bet_id ON combined_bet_items(combined_bet_id);

-- Trigger para updated_at
DROP TRIGGER IF EXISTS update_combined_bets_updated_at ON combined_bets;
CREATE TRIGGER update_combined_bets_updated_at
  BEFORE UPDATE ON combined_bets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger para atualizar saldo da carteira (igual ao de apostas simples)
CREATE OR REPLACE FUNCTION update_wallet_balance_on_combined_bet()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE wallets SET balance = balance - NEW.amount WHERE id = NEW.wallet_id;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.result = 'pending' AND NEW.result IN ('win', 'cashout') THEN
      UPDATE wallets SET balance = balance + NEW.return_amount WHERE id = NEW.wallet_id;
    ELSIF OLD.result IN ('win', 'cashout') AND NEW.result = 'pending' THEN
      UPDATE wallets SET balance = balance - OLD.return_amount WHERE id = NEW.wallet_id;
    ELSIF OLD.result IN ('win', 'cashout') AND NEW.result IN ('win', 'cashout') THEN
      UPDATE wallets SET balance = balance - OLD.return_amount + NEW.return_amount WHERE id = NEW.wallet_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.result = 'pending' THEN
      UPDATE wallets SET balance = balance + OLD.amount WHERE id = OLD.wallet_id;
    ELSIF OLD.result IN ('win', 'cashout') THEN
      UPDATE wallets SET balance = balance + OLD.amount - OLD.return_amount WHERE id = OLD.wallet_id;
    ELSE
      UPDATE wallets SET balance = balance + OLD.amount WHERE id = OLD.wallet_id;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_wallet_on_combined_bet ON combined_bets;
CREATE TRIGGER update_wallet_on_combined_bet
  AFTER INSERT OR UPDATE OR DELETE ON combined_bets
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_balance_on_combined_bet();
