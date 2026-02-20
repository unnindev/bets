import type { FootballAPIResponse, FootballMatch, SimpleMatch } from '@/types/football';

// Cache em memória com TTL
const cache = new Map<string, { data: unknown; timestamp: number }>();

// TTL padrão: 5 minutos para jogos, 1 hora para dados estáticos
const CACHE_TTL_FIXTURES = 5 * 60 * 1000; // 5 minutos
const CACHE_TTL_STATIC = 60 * 60 * 1000; // 1 hora

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
    homeTeamLogo: match.teams.home.logo,
    awayTeam: match.teams.away.name,
    awayTeamLogo: match.teams.away.logo,
    homeGoals: match.goals.home,
    awayGoals: match.goals.away,
    league: match.league.name,
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
