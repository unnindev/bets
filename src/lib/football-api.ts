import type { FootballMatch, SimpleMatch, TeamForm } from '@/types/football';

// Cache em memória com TTL
const cache = new Map<string, { data: unknown; timestamp: number }>();

// Rate limit info
let rateLimitInfo = {
  requestsRemaining: 10,
  requestsLimit: 10,
  lastUpdated: 0,
};

// TTL padrão: 5 minutos para jogos, 3 horas para dados estáticos
const CACHE_TTL_FIXTURES = 5 * 60 * 1000; // 5 minutos
const CACHE_TTL_STATIC = 3 * 60 * 60 * 1000; // 3 horas

interface CacheOptions {
  ttl?: number;
}

// Limpar cache antigo
function cleanOldCache(): void {
  if (cache.size > 100) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now - v.timestamp > CACHE_TTL_STATIC) {
        cache.delete(k);
      }
    }
  }
}

// Interface da resposta da Football-Data.org
interface FootballDataMatch {
  id: number;
  utcDate: string;
  status: 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'SUSPENDED' | 'POSTPONED' | 'CANCELLED' | 'AWARDED';
  matchday: number;
  stage: string;
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    tla: string;
    crest: string;
  };
  score: {
    winner: string | null;
    fullTime: { home: number | null; away: number | null };
    halfTime: { home: number | null; away: number | null };
  };
  competition: {
    id: number;
    name: string;
    code: string;
    emblem: string;
  };
  area: {
    name: string;
    flag: string;
  };
}

interface FootballDataResponse {
  matches: FootballDataMatch[];
  resultSet?: {
    count: number;
  };
}

// Mapear status da Football-Data.org para o formato anterior
function mapStatus(status: string): { long: string; short: string } {
  const statusMap: Record<string, { long: string; short: string }> = {
    'SCHEDULED': { long: 'Not Started', short: 'NS' },
    'TIMED': { long: 'Not Started', short: 'NS' },
    'IN_PLAY': { long: 'In Play', short: 'LIVE' },
    'PAUSED': { long: 'Half Time', short: 'HT' },
    'FINISHED': { long: 'Match Finished', short: 'FT' },
    'SUSPENDED': { long: 'Suspended', short: 'SUSP' },
    'POSTPONED': { long: 'Postponed', short: 'PST' },
    'CANCELLED': { long: 'Cancelled', short: 'CANC' },
    'AWARDED': { long: 'Awarded', short: 'AWD' },
  };
  return statusMap[status] || { long: status, short: status };
}

// Converter resposta da Football-Data.org para o formato FootballMatch
function convertToFootballMatch(match: FootballDataMatch): FootballMatch {
  const statusInfo = mapStatus(match.status);
  const utcDate = new Date(match.utcDate);

  return {
    fixture: {
      id: match.id,
      referee: null,
      timezone: 'UTC',
      date: match.utcDate,
      timestamp: Math.floor(utcDate.getTime() / 1000),
      periods: { first: null, second: null },
      venue: { id: null, name: null, city: null },
      status: {
        long: statusInfo.long,
        short: statusInfo.short as FootballMatch['fixture']['status']['short'],
        elapsed: null,
      },
    },
    league: {
      id: match.competition.id,
      name: match.competition.name,
      country: match.area.name,
      logo: match.competition.emblem,
      flag: match.area.flag,
      season: new Date().getFullYear(),
      round: match.stage,
    },
    teams: {
      home: {
        id: match.homeTeam.id,
        name: match.homeTeam.name,
        logo: match.homeTeam.crest,
        winner: match.score.winner === 'HOME_TEAM',
      },
      away: {
        id: match.awayTeam.id,
        name: match.awayTeam.name,
        logo: match.awayTeam.crest,
        winner: match.score.winner === 'AWAY_TEAM',
      },
    },
    goals: {
      home: match.score.fullTime.home,
      away: match.score.fullTime.away,
    },
    score: {
      halftime: match.score.halfTime,
      fulltime: match.score.fullTime,
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  };
}

// Função genérica para fazer requisições à API
async function fetchFootballDataAPI<T>(
  endpoint: string,
  options?: CacheOptions
): Promise<T> {
  const cacheKey = `football:${endpoint}`;
  const ttl = options?.ttl || CACHE_TTL_FIXTURES;

  // Verificar cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data as T;
  }

  const baseUrl = process.env.FOOTBALL_API_BASE_URL || 'https://api.football-data.org/v4';
  const apiKey = process.env.FOOTBALL_API_KEY;

  if (!apiKey) {
    throw new Error('FOOTBALL_API_KEY não configurada');
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      'X-Auth-Token': apiKey,
    },
    next: {
      revalidate: ttl / 1000,
    },
  });

  // Capturar rate limit dos headers
  const remaining = response.headers.get('x-requests-available-minute');
  if (remaining !== null) {
    rateLimitInfo = {
      requestsRemaining: parseInt(remaining, 10),
      requestsLimit: 10,
      lastUpdated: Date.now(),
    };
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Football-Data error: ${response.status} - ${errorText}`);
  }

  const data = await response.json() as T;

  // Salvar no cache
  cache.set(cacheKey, { data, timestamp: Date.now() });
  cleanOldCache();

  return data;
}

// Buscar jogos por data
export async function getFixturesByDate(date: string, leagueId?: number): Promise<FootballMatch[]> {
  let endpoint = `/matches?date=${date}`;

  // Football-Data.org usa códigos de competição diferentes
  // Para filtrar por liga específica, usar competitions endpoint
  if (leagueId) {
    endpoint = `/competitions/${leagueId}/matches?date=${date}`;
  }

  const response = await fetchFootballDataAPI<FootballDataResponse>(endpoint);
  return (response.matches || []).map(convertToFootballMatch);
}

// Buscar jogos ao vivo
export async function getLiveFixtures(): Promise<FootballMatch[]> {
  // Football-Data.org não tem endpoint específico para live
  // Buscar jogos de hoje e filtrar os que estão em andamento
  const today = new Date().toISOString().split('T')[0];
  const response = await fetchFootballDataAPI<FootballDataResponse>(
    `/matches?date=${today}`,
    { ttl: 60 * 1000 } // 1 minuto para jogos ao vivo
  );

  return (response.matches || [])
    .filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED')
    .map(convertToFootballMatch);
}

// Buscar jogo específico por ID
export async function getFixtureById(fixtureId: number): Promise<FootballMatch | null> {
  try {
    const response = await fetchFootballDataAPI<FootballDataMatch>(`/matches/${fixtureId}`);
    return convertToFootballMatch(response);
  } catch {
    return null;
  }
}

// Converter para formato simplificado
export function toSimpleMatch(match: FootballMatch): SimpleMatch {
  const timestamp = match.fixture.timestamp;
  const date = new Date(timestamp * 1000);

  return {
    id: match.fixture.id,
    timestamp,
    date: date.toISOString().split('T')[0],
    time: date.toISOString().split('T')[1].slice(0, 5),
    status: match.fixture.status.long,
    statusShort: match.fixture.status.short,
    homeTeam: match.teams.home.name,
    homeTeamId: match.teams.home.id,
    homeTeamLogo: match.teams.home.logo,
    awayTeam: match.teams.away.name,
    awayTeamId: match.teams.away.id,
    awayTeamLogo: match.teams.away.logo,
    homeGoals: match.goals.home,
    awayGoals: match.goals.away,
    league: match.league.name,
    leagueId: match.league.id,
    leagueLogo: match.league.logo,
    country: match.league.country,
  };
}

// Verificar se um jogo já terminou
export function isMatchFinished(match: FootballMatch): boolean {
  const finishedStatuses = ['FT', 'AET', 'PEN', 'AWD', 'WO'];
  return finishedStatuses.includes(match.fixture.status.short);
}

// Verificar se um jogo está ao vivo
export function isMatchLive(match: FootballMatch): boolean {
  const liveStatuses = ['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'];
  return liveStatuses.includes(match.fixture.status.short);
}

// Verificar se um jogo ainda não começou
export function isMatchScheduled(match: FootballMatch): boolean {
  const scheduledStatuses = ['TBD', 'NS'];
  return scheduledStatuses.includes(match.fixture.status.short);
}

// Limpar todo o cache
export function clearCache(): void {
  cache.clear();
}

// Obter estatísticas do cache
export function getCacheStats(): { size: number; keys: string[] } {
  return {
    size: cache.size,
    keys: Array.from(cache.keys()),
  };
}

// Obter informações de rate limit
export function getRateLimitInfo() {
  return rateLimitInfo;
}

// Calcular a temporada atual
function getCurrentSeason(): number {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  if (month < 7) {
    return year - 1;
  }
  return year;
}

// Buscar últimos jogos de um time
export async function getTeamLastMatches(teamId: number, last: number = 5): Promise<FootballMatch[]> {
  try {
    const response = await fetchFootballDataAPI<FootballDataResponse>(
      `/teams/${teamId}/matches?status=FINISHED&limit=${last}`,
      { ttl: CACHE_TTL_STATIC }
    );

    return (response.matches || [])
      .map(convertToFootballMatch)
      .slice(0, last);
  } catch {
    return [];
  }
}

// Calcular forma recente de um time
export function calculateTeamForm(teamId: number, teamName: string, matches: FootballMatch[]): TeamForm {
  const form: ('W' | 'D' | 'L')[] = [];
  const lastMatches: TeamForm['lastMatches'] = [];
  let wins = 0, draws = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;

  for (const match of matches) {
    const isHome = match.teams.home.id === teamId;
    const teamGoals = isHome ? match.goals.home : match.goals.away;
    const opponentGoals = isHome ? match.goals.away : match.goals.home;
    const opponent = isHome ? match.teams.away.name : match.teams.home.name;

    if (teamGoals === null || opponentGoals === null) continue;

    goalsFor += teamGoals;
    goalsAgainst += opponentGoals;

    let result: 'W' | 'D' | 'L';
    if (teamGoals > opponentGoals) {
      result = 'W';
      wins++;
    } else if (teamGoals < opponentGoals) {
      result = 'L';
      losses++;
    } else {
      result = 'D';
      draws++;
    }

    form.push(result);
    lastMatches.push({
      opponent,
      result,
      score: `${teamGoals}-${opponentGoals}`,
      home: isHome,
    });
  }

  return {
    teamId,
    teamName,
    form,
    wins,
    draws,
    losses,
    goalsFor,
    goalsAgainst,
    lastMatches,
  };
}

// Buscar forma de um time
export async function getTeamForm(teamId: number, teamName: string, last: number = 5): Promise<TeamForm> {
  const matches = await getTeamLastMatches(teamId, last);
  return calculateTeamForm(teamId, teamName, matches);
}

// Buscar confrontos diretos entre dois times
export async function getHeadToHead(teamId1: number, teamId2: number, last: number = 5): Promise<FootballMatch[]> {
  try {
    const response = await fetchFootballDataAPI<FootballDataResponse>(
      `/teams/${teamId1}/matches?status=FINISHED&limit=50`,
      { ttl: CACHE_TTL_STATIC }
    );

    // Filtrar apenas jogos contra o outro time
    const h2hMatches = (response.matches || [])
      .filter(m => m.homeTeam.id === teamId2 || m.awayTeam.id === teamId2)
      .slice(0, last)
      .map(convertToFootballMatch);

    return h2hMatches;
  } catch {
    return [];
  }
}

// Análise de confrontos diretos
export interface H2HAnalysis {
  team1Id: number;
  team2Id: number;
  team1Name: string;
  team2Name: string;
  matches: number;
  team1Wins: number;
  team2Wins: number;
  draws: number;
  team1Goals: number;
  team2Goals: number;
  lastMatches: {
    date: string;
    homeTeam: string;
    awayTeam: string;
    score: string;
    winner: 'home' | 'away' | 'draw';
  }[];
}

export async function analyzeHeadToHead(
  teamId1: number,
  teamName1: string,
  teamId2: number,
  teamName2: string,
  last: number = 5
): Promise<H2HAnalysis> {
  const matches = await getHeadToHead(teamId1, teamId2, last);

  let team1Wins = 0, team2Wins = 0, draws = 0;
  let team1Goals = 0, team2Goals = 0;
  const lastMatches: H2HAnalysis['lastMatches'] = [];

  for (const match of matches) {
    const homeGoals = match.goals.home ?? 0;
    const awayGoals = match.goals.away ?? 0;
    const homeIsTeam1 = match.teams.home.id === teamId1;

    if (homeIsTeam1) {
      team1Goals += homeGoals;
      team2Goals += awayGoals;
    } else {
      team1Goals += awayGoals;
      team2Goals += homeGoals;
    }

    let winner: 'home' | 'away' | 'draw';
    if (homeGoals > awayGoals) {
      winner = 'home';
      if (homeIsTeam1) team1Wins++; else team2Wins++;
    } else if (awayGoals > homeGoals) {
      winner = 'away';
      if (homeIsTeam1) team2Wins++; else team1Wins++;
    } else {
      winner = 'draw';
      draws++;
    }

    lastMatches.push({
      date: new Date(match.fixture.date).toISOString().split('T')[0],
      homeTeam: match.teams.home.name,
      awayTeam: match.teams.away.name,
      score: `${homeGoals}-${awayGoals}`,
      winner,
    });
  }

  return {
    team1Id: teamId1,
    team2Id: teamId2,
    team1Name: teamName1,
    team2Name: teamName2,
    matches: matches.length,
    team1Wins,
    team2Wins,
    draws,
    team1Goals,
    team2Goals,
    lastMatches,
  };
}
