import type { FootballAPIResponse, FootballMatch, SimpleMatch, TeamForm } from '@/types/football';

// Cache em memória com TTL
const cache = new Map<string, { data: unknown; timestamp: number }>();

// Rate limit info (atualizado a cada request real)
let rateLimitInfo = {
  requestsRemaining: 100,
  requestsLimit: 100,
  lastUpdated: 0,
};

// TTL padrão: 5 minutos para jogos, 3 horas para dados estáticos
const CACHE_TTL_FIXTURES = 5 * 60 * 1000; // 5 minutos
const CACHE_TTL_STATIC = 3 * 60 * 60 * 1000; // 3 horas

interface CacheOptions {
  ttl?: number;
}

// Limpar cache antigo se tiver muitos itens
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

export async function fetchFootballAPI<T>(
  endpoint: string,
  options?: CacheOptions
): Promise<FootballAPIResponse<T>> {
  const cacheKey = `football:${endpoint}`;
  const ttl = options?.ttl || CACHE_TTL_FIXTURES;

  // Verificar cache
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data as FootballAPIResponse<T>;
  }

  const baseUrl = process.env.FOOTBALL_API_BASE_URL || 'https://v3.football.api-sports.io';
  const apiKey = process.env.FOOTBALL_API_KEY;

  if (!apiKey) {
    throw new Error('FOOTBALL_API_KEY não configurada');
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      'x-apisports-key': apiKey,
    },
    next: {
      revalidate: ttl / 1000, // Next.js cache em segundos
    },
  });

  if (!response.ok) {
    throw new Error(`API Football error: ${response.status} ${response.statusText}`);
  }

  // Capturar informações de rate limit dos headers
  const remaining = response.headers.get('x-ratelimit-requests-remaining');
  const limit = response.headers.get('x-ratelimit-requests-limit');
  if (remaining !== null && limit !== null) {
    rateLimitInfo = {
      requestsRemaining: parseInt(remaining, 10),
      requestsLimit: parseInt(limit, 10),
      lastUpdated: Date.now(),
    };
  }

  const data = await response.json() as FootballAPIResponse<T>;

  // Verificar erros da API
  if (data.errors && Object.keys(data.errors).length > 0) {
    const errorMsg = Array.isArray(data.errors)
      ? data.errors.join(', ')
      : Object.values(data.errors).join(', ');
    throw new Error(`API Football error: ${errorMsg}`);
  }

  // Salvar no cache
  cache.set(cacheKey, { data, timestamp: Date.now() });

  return data;
}

// Buscar jogos por data
export async function getFixturesByDate(date: string, leagueId?: number): Promise<FootballMatch[]> {
  let endpoint = `/fixtures?date=${date}`;
  if (leagueId) {
    endpoint += `&league=${leagueId}`;
  }

  const response = await fetchFootballAPI<FootballMatch>(endpoint);
  return response.response;
}

// Buscar jogos ao vivo
export async function getLiveFixtures(): Promise<FootballMatch[]> {
  const response = await fetchFootballAPI<FootballMatch>('/fixtures?live=all', {
    ttl: 60 * 1000, // 1 minuto para jogos ao vivo
  });
  return response.response;
}

// Buscar jogo específico por ID
export async function getFixtureById(fixtureId: number): Promise<FootballMatch | null> {
  const response = await fetchFootballAPI<FootballMatch>(`/fixtures?id=${fixtureId}`);
  return response.response[0] || null;
}

// Converter para formato simplificado
export function toSimpleMatch(match: FootballMatch): SimpleMatch {
  const date = new Date(match.fixture.date);

  return {
    id: match.fixture.id,
    date: date.toISOString().split('T')[0],
    time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
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

// Limpar todo o cache (útil para testes)
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

// Buscar últimos jogos de um time
export async function getTeamLastMatches(teamId: number, last: number = 5): Promise<FootballMatch[]> {
  const response = await fetchFootballAPI<FootballMatch>(`/fixtures?team=${teamId}&last=${last}`, {
    ttl: CACHE_TTL_STATIC, // Cache de 1 hora para histórico
  });
  return response.response;
}

// Calcular forma recente de um time baseado nos últimos jogos
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

// Buscar forma de um time (últimos N jogos)
export async function getTeamForm(teamId: number, teamName: string, last: number = 5): Promise<TeamForm> {
  const matches = await getTeamLastMatches(teamId, last);
  return calculateTeamForm(teamId, teamName, matches);
}

// Buscar confrontos diretos entre dois times
export async function getHeadToHead(teamId1: number, teamId2: number, last: number = 5): Promise<FootballMatch[]> {
  const response = await fetchFootballAPI<FootballMatch>(`/fixtures/headtohead?h2h=${teamId1}-${teamId2}&last=${last}`, {
    ttl: CACHE_TTL_STATIC,
  });
  return response.response;
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
