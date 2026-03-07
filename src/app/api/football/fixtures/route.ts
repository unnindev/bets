import { NextResponse } from 'next/server';
import { getFixturesByDate, getLiveFixtures, toSimpleMatch, getRateLimitInfo } from '@/lib/football-api';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const league = searchParams.get('league');
    const live = searchParams.get('live');

    let matches;

    if (live === 'true') {
      // Buscar jogos ao vivo
      matches = await getLiveFixtures();
    } else if (date) {
      // Buscar jogos por data
      const leagueId = league ? parseInt(league, 10) : undefined;
      matches = await getFixturesByDate(date, leagueId);
    } else {
      // Default: jogos de hoje
      const today = new Date().toISOString().split('T')[0];
      matches = await getFixturesByDate(today);
    }

    // Converter para formato simplificado
    const simpleMatches = matches.map(toSimpleMatch);

    // Ordenar por horário usando timestamp UTC
    simpleMatches.sort((a, b) => a.timestamp - b.timestamp);

    return NextResponse.json({
      success: true,
      count: simpleMatches.length,
      matches: simpleMatches,
      rateLimit: getRateLimitInfo(),
    });
  } catch (error) {
    console.error('Error fetching fixtures:', error);

    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        matches: [],
      },
      { status: 500 }
    );
  }
}
