-- Tabela de campeonatos
CREATE TABLE IF NOT EXISTS championships (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  country TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de times
CREATE TABLE IF NOT EXISTS teams (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  country TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Desabilitar RLS (já que só vocês usam)
ALTER TABLE championships DISABLE ROW LEVEL SECURITY;
ALTER TABLE teams DISABLE ROW LEVEL SECURITY;

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_championships_name ON championships(name);
CREATE INDEX IF NOT EXISTS idx_teams_name ON teams(name);
