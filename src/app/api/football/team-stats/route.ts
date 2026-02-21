import { NextResponse } from 'next/server';
import { getTeamForm, analyzeHeadToHead, type H2HAnalysis } from '@/lib/football-api';
import type { TeamForm } from '@/types/football';

export interface TeamStatsResponse {
  homeForm?: TeamForm;
  awayForm?: TeamForm;
  h2h?: H2HAnalysis;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const homeTeamId = searchParams.get('homeTeamId');
    const awayTeamId = searchParams.get('awayTeamId');
    const homeTeamName = searchParams.get('homeTeamName');
    const awayTeamName = searchParams.get('awayTeamName');
    const includeH2H = searchParams.get('h2h') === 'true';
    const last = parseInt(searchParams.get('last') || '5', 10);

    if (!homeTeamId || !awayTeamId) {
      return NextResponse.json(
        { error: 'homeTeamId e awayTeamId são obrigatórios' },
        { status: 400 }
      );
    }

    const homeId = parseInt(homeTeamId, 10);
    const awayId = parseInt(awayTeamId, 10);

    const result: TeamStatsResponse = {};

    // Buscar forma dos times em paralelo
    const [homeForm, awayForm] = await Promise.all([
      getTeamForm(homeId, homeTeamName || 'Time Casa', last),
      getTeamForm(awayId, awayTeamName || 'Time Visitante', last),
    ]);

    result.homeForm = homeForm;
    result.awayForm = awayForm;

    // Buscar H2H se solicitado
    if (includeH2H) {
      result.h2h = await analyzeHeadToHead(
        homeId,
        homeTeamName || 'Time Casa',
        awayId,
        awayTeamName || 'Time Visitante',
        last
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao buscar estatísticas' },
      { status: 500 }
    );
  }
}
