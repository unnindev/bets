import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getFixtureById, isMatchFinished } from '@/lib/football-api';
import type { BetType, BetResult } from '@/types';

interface UpdateResult {
  betId: string;
  fixture_id: number;
  result: BetResult;
  score_team_a: number;
  score_team_b: number;
  return_amount: number;
  error?: string;
}

// Determina o resultado da aposta baseado no tipo e placar
function determineBetResult(
  betType: BetType,
  betTypeDescription: string | null,
  homeGoals: number,
  awayGoals: number,
  amount: number,
  odds: number
): { result: BetResult; return_amount: number } {
  let won = false;
  const totalGoals = homeGoals + awayGoals;

  switch (betType) {
    case 'team_a':
      // Vitória do time da casa
      won = homeGoals > awayGoals;
      break;

    case 'team_b':
      // Vitória do time visitante
      won = awayGoals > homeGoals;
      break;

    case 'draw':
      // Empate
      won = homeGoals === awayGoals;
      break;

    case 'team_a_or_draw':
      // Dupla chance: casa ou empate
      won = homeGoals >= awayGoals;
      break;

    case 'team_b_or_draw':
      // Dupla chance: visitante ou empate
      won = awayGoals >= homeGoals;
      break;

    case 'team_a_or_team_b':
      // Dupla chance: qualquer time vence (não empata)
      won = homeGoals !== awayGoals;
      break;

    case 'over':
      // Over X gols - extrai o número da descrição
      if (betTypeDescription) {
        const match = betTypeDescription.match(/(\d+\.?\d*)/);
        if (match) {
          const line = parseFloat(match[1]);
          won = totalGoals > line;
        }
      }
      break;

    case 'under':
      // Under X gols - extrai o número da descrição
      if (betTypeDescription) {
        const match = betTypeDescription.match(/(\d+\.?\d*)/);
        if (match) {
          const line = parseFloat(match[1]);
          won = totalGoals < line;
        }
      }
      break;

    case 'both_score_yes':
      // Ambos marcam: sim
      won = homeGoals > 0 && awayGoals > 0;
      break;

    case 'both_score_no':
      // Ambos marcam: não
      won = homeGoals === 0 || awayGoals === 0;
      break;

    case 'other':
      // Tipo personalizado - não pode ser verificado automaticamente
      return { result: 'pending', return_amount: 0 };
  }

  return {
    result: won ? 'win' : 'loss',
    return_amount: won ? amount * odds : 0,
  };
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Verificar autenticação
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Buscar apostas pendentes com fixture_id
    const { data: pendingBets, error: betsError } = await supabase
      .from('bets')
      .select('id, fixture_id, bet_type, bet_type_description, amount, odds, wallet_id')
      .eq('result', 'pending')
      .not('fixture_id', 'is', null);

    if (betsError) {
      throw new Error(`Erro ao buscar apostas: ${betsError.message}`);
    }

    if (!pendingBets || pendingBets.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Nenhuma aposta pendente com jogo vinculado',
        updated: 0,
        results: [],
      });
    }

    const results: UpdateResult[] = [];
    let updatedCount = 0;

    // Verificar cada aposta
    for (const bet of pendingBets) {
      try {
        // Buscar jogo na API
        const match = await getFixtureById(bet.fixture_id);

        if (!match) {
          results.push({
            betId: bet.id,
            fixture_id: bet.fixture_id,
            result: 'pending',
            score_team_a: 0,
            score_team_b: 0,
            return_amount: 0,
            error: 'Jogo não encontrado na API',
          });
          continue;
        }

        // Verificar se o jogo terminou
        if (!isMatchFinished(match)) {
          results.push({
            betId: bet.id,
            fixture_id: bet.fixture_id,
            result: 'pending',
            score_team_a: match.goals.home ?? 0,
            score_team_b: match.goals.away ?? 0,
            return_amount: 0,
            error: 'Jogo ainda não terminou',
          });
          continue;
        }

        const homeGoals = match.goals.home ?? 0;
        const awayGoals = match.goals.away ?? 0;

        // Determinar resultado da aposta
        const { result, return_amount } = determineBetResult(
          bet.bet_type as BetType,
          bet.bet_type_description,
          homeGoals,
          awayGoals,
          bet.amount,
          bet.odds
        );

        // Se não foi possível determinar (tipo 'other'), pular
        if (result === 'pending') {
          results.push({
            betId: bet.id,
            fixture_id: bet.fixture_id,
            result: 'pending',
            score_team_a: homeGoals,
            score_team_b: awayGoals,
            return_amount: 0,
            error: 'Tipo de aposta não pode ser verificado automaticamente',
          });
          continue;
        }

        // Atualizar aposta no banco
        const { error: updateError } = await supabase
          .from('bets')
          .update({
            result,
            score_team_a: homeGoals,
            score_team_b: awayGoals,
            return_amount,
          })
          .eq('id', bet.id);

        if (updateError) {
          results.push({
            betId: bet.id,
            fixture_id: bet.fixture_id,
            result: 'pending',
            score_team_a: homeGoals,
            score_team_b: awayGoals,
            return_amount: 0,
            error: `Erro ao atualizar: ${updateError.message}`,
          });
          continue;
        }

        updatedCount++;
        results.push({
          betId: bet.id,
          fixture_id: bet.fixture_id,
          result,
          score_team_a: homeGoals,
          score_team_b: awayGoals,
          return_amount,
        });

      } catch (err) {
        results.push({
          betId: bet.id,
          fixture_id: bet.fixture_id,
          result: 'pending',
          score_team_a: 0,
          score_team_b: 0,
          return_amount: 0,
          error: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${updatedCount} aposta(s) atualizada(s)`,
      updated: updatedCount,
      total: pendingBets.length,
      results,
    });

  } catch (error) {
    console.error('Error checking bet results:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      },
      { status: 500 }
    );
  }
}
