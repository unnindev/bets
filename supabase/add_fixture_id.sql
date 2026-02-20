-- Adicionar coluna fixture_id para rastrear jogos da API
-- Execute este SQL no Supabase SQL Editor

-- Adicionar coluna fixture_id na tabela bets
ALTER TABLE bets
ADD COLUMN IF NOT EXISTS fixture_id INTEGER;

-- Criar índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_bets_fixture_id ON bets(fixture_id);

-- Adicionar fixture_id também na tabela de itens de apostas combinadas (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'combined_bet_items') THEN
    ALTER TABLE combined_bet_items
    ADD COLUMN IF NOT EXISTS fixture_id INTEGER;

    CREATE INDEX IF NOT EXISTS idx_combined_bet_items_fixture_id ON combined_bet_items(fixture_id);
  END IF;
END $$;
