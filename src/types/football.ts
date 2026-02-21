// Tipos para a API-Football (https://api-football.com)

export interface FootballTeam {
  id: number;
  name: string;
  logo: string;
  winner: boolean | null;
}

export interface FootballLeague {
  id: number;
  name: string;
  country: string;
  logo: string;
  flag: string | null;
  season: number;
  round: string | null;
}

export interface FootballFixtureStatus {
  long: string;
  short: 'TBD' | 'NS' | '1H' | 'HT' | '2H' | 'ET' | 'BT' | 'P' | 'SUSP' | 'INT' | 'FT' | 'AET' | 'PEN' | 'PST' | 'CANC' | 'ABD' | 'AWD' | 'WO' | 'LIVE';
  elapsed: number | null;
}

export interface FootballFixture {
  id: number;
  referee: string | null;
  timezone: string;
  date: string;
  timestamp: number;
  periods: {
    first: number | null;
    second: number | null;
  };
  venue: {
    id: number | null;
    name: string | null;
    city: string | null;
  };
  status: FootballFixtureStatus;
}

export interface FootballGoals {
  home: number | null;
  away: number | null;
}

export interface FootballScore {
  halftime: FootballGoals;
  fulltime: FootballGoals;
  extratime: FootballGoals;
  penalty: FootballGoals;
}

export interface FootballMatch {
  fixture: FootballFixture;
  league: FootballLeague;
  teams: {
    home: FootballTeam;
    away: FootballTeam;
  };
  goals: FootballGoals;
  score: FootballScore;
}

export interface FootballAPIResponse<T> {
  get: string;
  parameters: Record<string, string>;
  errors: string[] | Record<string, string>;
  results: number;
  paging: {
    current: number;
    total: number;
  };
  response: T[];
}

export type FixturesResponse = FootballAPIResponse<FootballMatch>;

// Tipos simplificados para uso no frontend
export interface SimpleMatch {
  id: number;
  date: string;
  time: string;
  status: string;
  statusShort: string;
  homeTeam: string;
  homeTeamId: number;
  homeTeamLogo: string;
  awayTeam: string;
  awayTeamId: number;
  awayTeamLogo: string;
  homeGoals: number | null;
  awayGoals: number | null;
  league: string;
  leagueId: number;
  leagueLogo: string;
  country: string;
}

// Forma recente de um time (últimos 5 jogos)
export interface TeamForm {
  teamId: number;
  teamName: string;
  form: ('W' | 'D' | 'L')[]; // Win, Draw, Loss
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  lastMatches: {
    opponent: string;
    result: 'W' | 'D' | 'L';
    score: string;
    home: boolean;
  }[];
}

// Estatísticas enriquecidas de um jogo
export interface MatchWithStats extends SimpleMatch {
  homeForm?: TeamForm;
  awayForm?: TeamForm;
}

// Ligas principais para filtro rápido
export const MAIN_LEAGUES = [
  { id: 71, name: 'Brasileirão Série A', country: 'Brazil' },
  { id: 72, name: 'Brasileirão Série B', country: 'Brazil' },
  { id: 73, name: 'Copa do Brasil', country: 'Brazil' },
  { id: 39, name: 'Premier League', country: 'England' },
  { id: 140, name: 'La Liga', country: 'Spain' },
  { id: 135, name: 'Serie A', country: 'Italy' },
  { id: 78, name: 'Bundesliga', country: 'Germany' },
  { id: 61, name: 'Ligue 1', country: 'France' },
  { id: 2, name: 'Champions League', country: 'World' },
  { id: 3, name: 'Europa League', country: 'World' },
  { id: 13, name: 'Libertadores', country: 'World' },
  { id: 11, name: 'Copa Sudamericana', country: 'World' },
] as const;

export type MainLeagueId = typeof MAIN_LEAGUES[number]['id'];
