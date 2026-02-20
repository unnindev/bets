import { NextResponse } from 'next/server';
import { MAIN_LEAGUES } from '@/types/football';

export async function GET() {
  // Retornar ligas principais (estático, não precisa chamar a API)
  // Isso economiza requests da cota gratuita

  return NextResponse.json({
    success: true,
    count: MAIN_LEAGUES.length,
    leagues: MAIN_LEAGUES,
  });
}
