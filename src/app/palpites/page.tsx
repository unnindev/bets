'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { formatPercentage, BET_TYPES } from '@/lib/constants';
import {
  Lightbulb,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Target,
  Trophy,
  Users,
  Calendar,
  Clock,
  Star,
  Info,
} from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import type { Bet, CombinedBet, BetType } from '@/types';
import type { SimpleMatch, TeamForm } from '@/types/football';
import type { TeamStatsResponse } from '@/app/api/football/team-stats/route';

interface RateLimitInfo {
  requestsRemaining: number;
  requestsLimit: number;
}

interface TeamHistory {
  name: string;
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  bestBetType: string;
  bestBetTypeWinRate: number;
}

interface ChampionshipHistory {
  name: string;
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  bestBetType: string;
  bestBetTypeWinRate: number;
}

interface BetTypeHistory {
  type: BetType;
  label: string;
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
}

interface Suggestion {
  match: SimpleMatch;
  confidence: number;
  reasons: string[];
  suggestedBetType: BetType;
  suggestedBetTypeLabel: string;
  teamStats?: TeamHistory;
  championshipStats?: ChampionshipHistory;
  betTypeStats?: BetTypeHistory;
  relevantHistory: {
    teamAWinRate?: number;
    teamBWinRate?: number;
    championshipWinRate?: number;
    betTypeWinRate?: number;
    totalRelevantBets: number;
  };
  // Dados da API
  homeForm?: TeamForm;
  awayForm?: TeamForm;
}

interface MatchStats {
  [matchId: number]: TeamStatsResponse;
}

function PalpitesContent() {
  const { selectedWalletId, isLoading: walletLoading } = useWallet();
  const [matches, setMatches] = useState<SimpleMatch[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [combinedBets, setCombinedBets] = useState<CombinedBet[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [matchStats, setMatchStats] = useState<MatchStats>({});
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Ref para rastrear jogos que já estão sendo carregados (evita chamadas duplicadas)
  const loadingMatchIdsRef = useRef<Set<number>>(new Set());
  // Ref para rastrear jogos que falharam (evita retry infinito)
  const failedMatchIdsRef = useRef<Set<number>>(new Set());
  // Flag para parar de tentar quando a API está com problema sistêmico
  const [apiDisabled, setApiDisabled] = useState(false);

  const supabase = createClient();

  // Carregar histórico de apostas
  useEffect(() => {
    if (selectedWalletId) {
      loadHistory();
    }
  }, [selectedWalletId]);

  // Carregar jogos quando a data mudar
  useEffect(() => {
    loadMatches();
  }, [selectedDate]);

  const loadHistory = async () => {
    if (!selectedWalletId) return;

    setIsLoadingHistory(true);

    const [betsRes, combinedRes] = await Promise.all([
      supabase
        .from('bets')
        .select('*')
        .eq('wallet_id', selectedWalletId)
        .neq('result', 'pending'),
      supabase
        .from('combined_bets')
        .select('*, items:combined_bet_items(*)')
        .eq('wallet_id', selectedWalletId)
        .neq('result', 'pending'),
    ]);

    if (betsRes.data) setBets(betsRes.data);
    if (combinedRes.data) setCombinedBets(combinedRes.data);

    setIsLoadingHistory(false);
  };

  const loadMatches = async () => {
    setIsLoadingMatches(true);
    setMatchStats({}); // Limpar stats anteriores
    setStatsError(null); // Limpar erro
    setApiDisabled(false); // Reativar API
    loadingMatchIdsRef.current.clear(); // Limpar ref de loading
    failedMatchIdsRef.current.clear(); // Limpar ref de falhas
    try {
      const response = await fetch(`/api/football/fixtures?date=${selectedDate}`);
      const data = await response.json();

      if (data.success) {
        // Mostrar todos os jogos - a lógica de sugestão vai considerar todos
        setMatches(data.matches || []);
        if (data.rateLimit) {
          setRateLimit(data.rateLimit);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar jogos:', error);
    } finally {
      setIsLoadingMatches(false);
    }
  };

  // Carregar estatísticas de times para jogos específicos
  const loadTeamStats = useCallback(async (matchesToLoad: SimpleMatch[]) => {
    // Filtrar jogos que já estão sendo carregados
    const newMatchesToLoad = matchesToLoad.filter(
      (m) => !loadingMatchIdsRef.current.has(m.id)
    );

    if (newMatchesToLoad.length === 0) return;

    setIsLoadingStats(true);
    setStatsError(null);

    // Marcar como "carregando" para evitar chamadas duplicadas
    newMatchesToLoad.forEach((m) => loadingMatchIdsRef.current.add(m.id));

    // Limitar a 5 jogos por vez para economizar requests da API
    const matchesSlice = newMatchesToLoad.slice(0, 5);
    const loadedStats: { matchId: number; stats: TeamStatsResponse }[] = [];
    const errors: string[] = [];

    await Promise.all(
      matchesSlice.map(async (match) => {
        try {
          const params = new URLSearchParams({
            homeTeamId: match.homeTeamId.toString(),
            awayTeamId: match.awayTeamId.toString(),
            homeTeamName: match.homeTeam,
            awayTeamName: match.awayTeam,
            h2h: 'true',
            last: '5',
          });

          const response = await fetch(`/api/football/team-stats?${params}`);
          if (response.ok) {
            const data: TeamStatsResponse = await response.json();
            loadedStats.push({ matchId: match.id, stats: data });
          } else {
            const errorData = await response.json().catch(() => ({}));
            errors.push(`${match.homeTeam} vs ${match.awayTeam}: ${errorData.error || response.status}`);
            // Marcar como falhou para não tentar novamente (evita loop infinito)
            failedMatchIdsRef.current.add(match.id);
          }
        } catch (error) {
          console.error(`Erro ao carregar stats do jogo ${match.id}:`, error);
          errors.push(`${match.homeTeam} vs ${match.awayTeam}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
          // Marcar como falhou para não tentar novamente
          failedMatchIdsRef.current.add(match.id);
        }
      })
    );

    // Usar functional update para evitar stale closure
    if (loadedStats.length > 0) {
      setMatchStats((prev) => {
        const updated = { ...prev };
        loadedStats.forEach(({ matchId, stats }) => {
          updated[matchId] = stats;
        });
        return updated;
      });
    }

    if (errors.length > 0) {
      setStatsError(errors[0]); // Mostrar apenas o primeiro erro para clareza

      // Se TODAS as requisições falharam, provavelmente é um problema com a API
      if (errors.length === matchesSlice.length && loadedStats.length === 0) {
        setApiDisabled(true);
      }
    }

    setIsLoadingStats(false);
  }, []);

  // Verificar se um jogo ainda pode ser apostado
  const canBetOn = (match: SimpleMatch) => {
    return match.statusShort === 'NS' || match.statusShort === 'TBD';
  };

  // Calcular estatísticas do histórico
  const historyStats = useMemo(() => {
    const teamStats: Record<string, TeamHistory> = {};
    const championshipStats: Record<string, ChampionshipHistory> = {};
    const betTypeStats: Record<string, BetTypeHistory> = {};

    // Inicializar betTypeStats
    BET_TYPES.forEach(({ value, label }) => {
      betTypeStats[value] = {
        type: value as BetType,
        label,
        totalBets: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
      };
    });

    // Processar apostas simples
    bets.forEach((bet) => {
      const isWin = bet.result === 'win';

      // Times
      [bet.team_a, bet.team_b].forEach((team) => {
        if (!teamStats[team]) {
          teamStats[team] = {
            name: team,
            totalBets: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            bestBetType: '',
            bestBetTypeWinRate: 0,
          };
        }
        teamStats[team].totalBets++;
        if (isWin) teamStats[team].wins++;
        else teamStats[team].losses++;
      });

      // Campeonato
      const champ = bet.championship;
      if (!championshipStats[champ]) {
        championshipStats[champ] = {
          name: champ,
          totalBets: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          bestBetType: '',
          bestBetTypeWinRate: 0,
        };
      }
      championshipStats[champ].totalBets++;
      if (isWin) championshipStats[champ].wins++;
      else championshipStats[champ].losses++;

      // Tipo de aposta
      const betType = bet.bet_type;
      if (betTypeStats[betType]) {
        betTypeStats[betType].totalBets++;
        if (isWin) betTypeStats[betType].wins++;
        else betTypeStats[betType].losses++;
      }
    });

    // Processar apostas combinadas
    combinedBets.forEach((cb) => {
      const isWin = cb.result === 'win';

      cb.items?.forEach((item) => {
        // Times
        [item.team_a, item.team_b].forEach((team) => {
          if (!teamStats[team]) {
            teamStats[team] = {
              name: team,
              totalBets: 0,
              wins: 0,
              losses: 0,
              winRate: 0,
              bestBetType: '',
              bestBetTypeWinRate: 0,
            };
          }
          teamStats[team].totalBets++;
          if (isWin) teamStats[team].wins++;
          else teamStats[team].losses++;
        });

        // Campeonato
        const champ = item.championship;
        if (!championshipStats[champ]) {
          championshipStats[champ] = {
            name: champ,
            totalBets: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            bestBetType: '',
            bestBetTypeWinRate: 0,
          };
        }
        championshipStats[champ].totalBets++;
        if (isWin) championshipStats[champ].wins++;
        else championshipStats[champ].losses++;

        // Tipo de aposta
        const betType = item.bet_type;
        if (betTypeStats[betType]) {
          betTypeStats[betType].totalBets++;
          if (isWin) betTypeStats[betType].wins++;
          else betTypeStats[betType].losses++;
        }
      });
    });

    // Calcular win rates
    Object.values(teamStats).forEach((stat) => {
      const total = stat.wins + stat.losses;
      stat.winRate = total > 0 ? (stat.wins / total) * 100 : 0;
    });

    Object.values(championshipStats).forEach((stat) => {
      const total = stat.wins + stat.losses;
      stat.winRate = total > 0 ? (stat.wins / total) * 100 : 0;
    });

    Object.values(betTypeStats).forEach((stat) => {
      const total = stat.wins + stat.losses;
      stat.winRate = total > 0 ? (stat.wins / total) * 100 : 0;
    });

    return {
      teams: teamStats,
      championships: championshipStats,
      betTypes: betTypeStats,
    };
  }, [bets, combinedBets]);

  // Gerar sugestões baseadas no cruzamento
  const suggestions = useMemo(() => {
    const result: Suggestion[] = [];

    matches.forEach((match) => {
      const teamAStats = historyStats.teams[match.homeTeam];
      const teamBStats = historyStats.teams[match.awayTeam];
      const champStats = historyStats.championships[match.league];
      const apiStats = matchStats[match.id];

      // Verificar se temos dados relevantes (histórico do usuário OU dados da API)
      const hasTeamAHistory = teamAStats && teamAStats.totalBets >= 3;
      const hasTeamBHistory = teamBStats && teamBStats.totalBets >= 3;
      const hasChampHistory = champStats && champStats.totalBets >= 3;
      const hasApiData = apiStats && (apiStats.homeForm || apiStats.awayForm);

      if (!hasTeamAHistory && !hasTeamBHistory && !hasChampHistory && !hasApiData) {
        return; // Pular jogos sem histórico relevante
      }

      const reasons: string[] = [];
      const warnings: string[] = [];
      let totalRelevantBets = 0;

      // ========== ANÁLISE INTELIGENTE ==========
      // Em vez de somar win rates, analisamos a DIFERENÇA entre os times

      const teamAWinRate = hasTeamAHistory ? teamAStats.winRate : 0;
      const teamBWinRate = hasTeamBHistory ? teamBStats.winRate : 0;
      const teamABets = hasTeamAHistory ? teamAStats.totalBets : 0;
      const teamBBets = hasTeamBHistory ? teamBStats.totalBets : 0;

      totalRelevantBets = teamABets + teamBBets;

      // Calcular forma recente dos times (dados da API)
      let homeFormScore = 0;
      let awayFormScore = 0;
      let homeFormWins = 0;
      let awayFormWins = 0;
      let homeFormLosses = 0;
      let awayFormLosses = 0;

      if (apiStats?.homeForm && apiStats.homeForm.form.length > 0) {
        homeFormWins = apiStats.homeForm.wins;
        homeFormLosses = apiStats.homeForm.losses;
        const homeTotal = apiStats.homeForm.form.length;
        homeFormScore = (homeFormWins / homeTotal) * 100;
      }

      if (apiStats?.awayForm && apiStats.awayForm.form.length > 0) {
        awayFormWins = apiStats.awayForm.wins;
        awayFormLosses = apiStats.awayForm.losses;
        const awayTotal = apiStats.awayForm.form.length;
        awayFormScore = (awayFormWins / awayTotal) * 100;
      }

      // ========== DETECTAR CENÁRIO DO JOGO ==========

      // Cenário 1: JOGO EQUILIBRADO - ambos os times têm win rates altos no histórico
      const bothTeamsGood = teamAWinRate >= 55 && teamBWinRate >= 55;
      const bothTeamsGreat = teamAWinRate >= 65 && teamBWinRate >= 65;

      // Cenário 2: VANTAGEM CLARA - um time é claramente melhor
      const historyDiff = Math.abs(teamAWinRate - teamBWinRate);
      const formDiff = Math.abs(homeFormScore - awayFormScore);
      const hasClearAdvantage = historyDiff >= 25 || formDiff >= 40;

      // Cenário 3: TIME RUIM vs TIME BOM
      const teamABad = teamAWinRate < 45 && teamABets >= 3;
      const teamBBad = teamBWinRate < 45 && teamBBets >= 3;
      const teamAGood = teamAWinRate >= 60;
      const teamBGood = teamBWinRate >= 60;

      // ========== CALCULAR CONFIANÇA BASEADA NO CENÁRIO ==========

      let confidence = 0;
      let suggestedBetType: BetType = 'team_a';
      let favoredTeam: 'home' | 'away' | 'none' = 'none';

      // CENÁRIO: Jogo muito equilibrado - BAIXA confiança
      if (bothTeamsGreat) {
        warnings.push(`⚠️ Jogo equilibrado: ambos têm win rate alto no seu histórico`);

        // Usar forma recente para desempatar
        if (formDiff >= 30) {
          if (homeFormScore > awayFormScore) {
            favoredTeam = 'home';
            confidence = 50 + (formDiff / 4); // Máx ~60-65%
            reasons.push(`${match.homeTeam} está em melhor fase (${homeFormWins}V nos últimos jogos)`);
          } else {
            favoredTeam = 'away';
            confidence = 50 + (formDiff / 4);
            reasons.push(`${match.awayTeam} está em melhor fase (${awayFormWins}V nos últimos jogos)`);
          }
        } else {
          // Forma também equilibrada - confiança muito baixa
          confidence = 45;
          warnings.push(`Forma recente também equilibrada - aposta arriscada`);
        }
      }
      // CENÁRIO: Um time bom vs um time ruim - ALTA confiança
      else if ((teamAGood && teamBBad) || (teamBGood && teamABad)) {
        if (teamAGood && teamBBad) {
          favoredTeam = 'home';
          confidence = 75 + Math.min(historyDiff / 5, 15); // 75-90%
          reasons.push(`${match.homeTeam}: ${formatPercentage(teamAWinRate)} de acerto em ${teamABets} apostas`);
          reasons.push(`${match.awayTeam}: apenas ${formatPercentage(teamBWinRate)} em ${teamBBets} apostas`);
        } else {
          favoredTeam = 'away';
          confidence = 75 + Math.min(historyDiff / 5, 15);
          reasons.push(`${match.awayTeam}: ${formatPercentage(teamBWinRate)} de acerto em ${teamBBets} apostas`);
          reasons.push(`${match.homeTeam}: apenas ${formatPercentage(teamAWinRate)} em ${teamABets} apostas`);
        }

        // Verificar se forma recente CONTRADIZ o histórico
        if (favoredTeam === 'home' && awayFormScore > homeFormScore + 30) {
          confidence -= 15;
          warnings.push(`⚠️ MAS ${match.awayTeam} está em boa fase recente (${awayFormWins}V)`);
        } else if (favoredTeam === 'away' && homeFormScore > awayFormScore + 30) {
          confidence -= 15;
          warnings.push(`⚠️ MAS ${match.homeTeam} está em boa fase recente (${homeFormWins}V)`);
        }
      }
      // CENÁRIO: Ambos medianos mas com diferença
      else if (hasClearAdvantage) {
        if (teamAWinRate > teamBWinRate) {
          favoredTeam = 'home';
          confidence = 55 + Math.min(historyDiff / 3, 20);
          reasons.push(`${match.homeTeam}: ${formatPercentage(teamAWinRate)} de acerto em ${teamABets} apostas`);
        } else {
          favoredTeam = 'away';
          confidence = 55 + Math.min(historyDiff / 3, 20);
          reasons.push(`${match.awayTeam}: ${formatPercentage(teamBWinRate)} de acerto em ${teamBBets} apostas`);
        }

        // Usar forma recente como bônus/penalidade
        if (favoredTeam === 'home' && homeFormScore >= 60) {
          confidence += 5;
          reasons.push(`${match.homeTeam} em boa fase (${homeFormWins}V nos últimos jogos)`);
        } else if (favoredTeam === 'away' && awayFormScore >= 60) {
          confidence += 5;
          reasons.push(`${match.awayTeam} em boa fase (${awayFormWins}V nos últimos jogos)`);
        }
      }
      // CENÁRIO: Só temos dados de forma recente (sem histórico pessoal)
      else if (!hasTeamAHistory && !hasTeamBHistory && hasApiData) {
        if (formDiff >= 40) {
          if (homeFormScore > awayFormScore) {
            favoredTeam = 'home';
            confidence = homeFormScore * 0.6; // Máx ~60%
            reasons.push(`${match.homeTeam} venceu ${homeFormWins} dos últimos jogos`);
            if (awayFormLosses >= 3) {
              reasons.push(`${match.awayTeam} perdeu ${awayFormLosses} dos últimos jogos`);
              confidence += 10;
            }
          } else {
            favoredTeam = 'away';
            confidence = awayFormScore * 0.6;
            reasons.push(`${match.awayTeam} venceu ${awayFormWins} dos últimos jogos`);
            if (homeFormLosses >= 3) {
              reasons.push(`${match.homeTeam} perdeu ${homeFormLosses} dos últimos jogos`);
              confidence += 10;
            }
          }
        } else if (homeFormScore >= 60 || awayFormScore >= 60) {
          warnings.push(`Sem histórico pessoal - usando apenas forma recente`);
          if (homeFormScore >= awayFormScore) {
            favoredTeam = 'home';
            confidence = homeFormScore * 0.5;
          } else {
            favoredTeam = 'away';
            confidence = awayFormScore * 0.5;
          }
        }
      }
      // CENÁRIO: Só temos histórico com um time
      else if (hasTeamAHistory && !hasTeamBHistory) {
        if (teamAWinRate >= 55) {
          favoredTeam = 'home';
          confidence = teamAWinRate * 0.8;
          reasons.push(`${match.homeTeam}: ${formatPercentage(teamAWinRate)} de acerto em ${teamABets} apostas`);

          // Verificar forma do adversário
          if (awayFormScore >= 70) {
            confidence -= 15;
            warnings.push(`⚠️ MAS ${match.awayTeam} está em ótima fase (${awayFormWins}V)`);
          }
        }
      } else if (hasTeamBHistory && !hasTeamAHistory) {
        if (teamBWinRate >= 55) {
          favoredTeam = 'away';
          confidence = teamBWinRate * 0.8;
          reasons.push(`${match.awayTeam}: ${formatPercentage(teamBWinRate)} de acerto em ${teamBBets} apostas`);

          // Verificar forma do adversário
          if (homeFormScore >= 70) {
            confidence -= 15;
            warnings.push(`⚠️ MAS ${match.homeTeam} está em ótima fase (${homeFormWins}V)`);
          }
        }
      }

      // ========== ANALISAR H2H (Confrontos Diretos) ==========
      if (apiStats?.h2h && apiStats.h2h.matches >= 3) {
        const h2h = apiStats.h2h;
        const h2hDiff = Math.abs(h2h.team1Wins - h2h.team2Wins);

        if (h2hDiff >= 2) {
          const h2hWinner = h2h.team1Wins > h2h.team2Wins ? h2h.team1Name : h2h.team2Name;
          const h2hWins = Math.max(h2h.team1Wins, h2h.team2Wins);

          reasons.push(`Histórico de confrontos: ${h2hWinner} venceu ${h2hWins} de ${h2h.matches}`);

          // Bônus se H2H confirma nossa análise
          const h2hFavorsHome = (h2h.team1Wins > h2h.team2Wins && h2h.team1Name === match.homeTeam) ||
                               (h2h.team2Wins > h2h.team1Wins && h2h.team2Name === match.homeTeam);

          if ((favoredTeam === 'home' && h2hFavorsHome) || (favoredTeam === 'away' && !h2hFavorsHome)) {
            confidence += 5;
          } else if (favoredTeam !== 'none') {
            confidence -= 5;
            warnings.push(`⚠️ H2H favorece o adversário`);
          }
        }
      }

      // ========== ANÁLISE DO CAMPEONATO ==========
      if (hasChampHistory && champStats.winRate >= 55) {
        totalRelevantBets += champStats.totalBets;
        const champWeight = Math.min(champStats.totalBets / 20, 0.15);
        confidence += champStats.winRate * champWeight;

        if (champStats.winRate >= 60) {
          reasons.push(`${match.league}: ${formatPercentage(champStats.winRate)} de acerto em ${champStats.totalBets} apostas`);
        }
      }

      // ========== DETERMINAR TIPO DE APOSTA ==========
      if (favoredTeam === 'home') {
        suggestedBetType = 'team_a';
      } else if (favoredTeam === 'away') {
        suggestedBetType = 'team_b';
      } else {
        // Sem favorito claro - sugerir empate ou tipo mais comum do usuário
        let bestBetType: BetType = 'draw';
        let bestRate = 0;
        Object.values(historyStats.betTypes).forEach((stat) => {
          if (stat.totalBets >= 5 && stat.winRate > bestRate) {
            bestRate = stat.winRate;
            bestBetType = stat.type;
          }
        });
        suggestedBetType = bestBetType;
      }

      // Garantir limites
      confidence = Math.max(0, Math.min(100, confidence));

      // Adicionar warnings às reasons (no início)
      const allReasons = [...warnings, ...reasons];

      // Só sugerir se tivermos confiança mínima e razões
      if (confidence >= 45 && allReasons.length > 0) {
        const betTypeLabel =
          BET_TYPES.find((t) => t.value === suggestedBetType)?.label || suggestedBetType;

        result.push({
          match,
          confidence,
          reasons: allReasons,
          suggestedBetType,
          suggestedBetTypeLabel: betTypeLabel,
          teamStats: teamAStats || teamBStats,
          championshipStats: champStats,
          betTypeStats: historyStats.betTypes[suggestedBetType],
          relevantHistory: {
            teamAWinRate: teamAStats?.winRate,
            teamBWinRate: teamBStats?.winRate,
            championshipWinRate: champStats?.winRate,
            betTypeWinRate: historyStats.betTypes[suggestedBetType]?.winRate,
            totalRelevantBets,
          },
          homeForm: apiStats?.homeForm,
          awayForm: apiStats?.awayForm,
        });
      }
    });

    // Ordenar por confiança
    return result.sort((a, b) => b.confidence - a.confidence);
  }, [matches, historyStats, matchStats]);

  // Carregar stats dos jogos quando os matches são carregados
  // Priorizar jogos das ligas principais
  useEffect(() => {
    if (matches.length === 0 || isLoadingStats || apiDisabled) return;

    // Ligas principais para priorizar
    const mainLeagueIds = [71, 72, 73, 39, 140, 135, 78, 61, 2, 3, 13, 11];

    // Filtrar jogos que ainda não têm stats, não estão sendo carregados, não falharam, e têm IDs de times
    const matchesWithoutStats = matches.filter(
      (m) =>
        !matchStats[m.id] &&
        !loadingMatchIdsRef.current.has(m.id) &&
        !failedMatchIdsRef.current.has(m.id) &&
        m.homeTeamId &&
        m.awayTeamId
    );

    if (matchesWithoutStats.length === 0) return;

    // Priorizar jogos das ligas principais, depois outros
    const prioritized = [
      ...matchesWithoutStats.filter((m) => mainLeagueIds.includes(m.leagueId)),
      ...matchesWithoutStats.filter((m) => !mainLeagueIds.includes(m.leagueId)),
    ].slice(0, 5); // Limitar a 5 jogos

    if (prioritized.length > 0) {
      loadTeamStats(prioritized);
    }
  }, [matches, matchStats, isLoadingStats, loadTeamStats, apiDisabled]);

  // Estatísticas gerais do dia
  const dayStats = useMemo(() => {
    return {
      totalMatches: matches.length,
      matchesWithHistory: suggestions.length,
      highConfidence: suggestions.filter((s) => s.confidence >= 65).length,
    };
  }, [matches, suggestions]);

  const isLoading = walletLoading || isLoadingHistory || isLoadingMatches;

  // Componente para mostrar forma recente (W/D/L)
  const FormDisplay = ({ form, teamName }: { form: TeamForm; teamName: string }) => {
    const formColors = {
      W: 'bg-emerald-500',
      D: 'bg-yellow-500',
      L: 'bg-red-500',
    };

    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 w-24 truncate">{teamName}</span>
        <div className="flex gap-0.5">
          {form.form.map((result, i) => (
            <div
              key={i}
              className={`w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center text-white ${formColors[result]}`}
              title={result === 'W' ? 'Vitória' : result === 'D' ? 'Empate' : 'Derrota'}
            >
              {result}
            </div>
          ))}
        </div>
        <span className="text-xs text-gray-400">
          {form.goalsFor}G / {form.goalsAgainst}S
        </span>
      </div>
    );
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 70) return 'text-emerald-400';
    if (confidence >= 60) return 'text-yellow-400';
    return 'text-orange-400';
  };

  const getConfidenceBg = (confidence: number) => {
    if (confidence >= 70) return 'bg-emerald-500/10 border-emerald-500/30';
    if (confidence >= 60) return 'bg-yellow-500/10 border-yellow-500/30';
    return 'bg-orange-500/10 border-orange-500/30';
  };

  return (
    <>
      {/* Header com seletor de data */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Palpites</h1>
          <p className="text-gray-400">
            Sugestões baseadas no seu histórico de apostas
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <Button
            variant="secondary"
            onClick={loadMatches}
            disabled={isLoadingMatches}
          >
            <RefreshCw className={`w-4 h-4 ${isLoadingMatches ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Atalhos de data */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-400">Atalhos:</span>
        {[
          { label: 'Hoje', days: 0 },
          { label: 'Amanhã', days: 1 },
          { label: 'Em 2 dias', days: 2 },
          { label: 'Em 3 dias', days: 3 },
        ].map(({ label, days }) => {
          const date = new Date();
          date.setDate(date.getDate() + days);
          const dateStr = date.toISOString().split('T')[0];
          const isSelected = selectedDate === dateStr;

          return (
            <button
              key={days}
              onClick={() => setSelectedDate(dateStr)}
              className={`px-3 py-1 text-sm rounded-full transition ${
                isSelected
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {label}
            </button>
          );
        })}
        {rateLimit && (
          <span className="ml-auto text-xs text-gray-500">
            API: {rateLimit.requestsRemaining}/{rateLimit.requestsLimit} restantes
          </span>
        )}
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Trophy className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Jogos do Dia</p>
                <p className="text-xl font-bold text-white">{dayStats.totalMatches}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <Users className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Com Histórico</p>
                <p className="text-xl font-bold text-white">{dayStats.matchesWithHistory}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <Star className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Alta Confiança</p>
                <p className="text-xl font-bold text-emerald-400">
                  {dayStats.highConfidence}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isLoadingStats ? 'bg-yellow-500/10' : statsError ? 'bg-red-500/10' : Object.keys(matchStats).length > 0 ? 'bg-emerald-500/10' : 'bg-gray-500/10'}`}>
                <TrendingUp className={`w-5 h-5 ${isLoadingStats ? 'text-yellow-400' : statsError ? 'text-red-400' : Object.keys(matchStats).length > 0 ? 'text-emerald-400' : 'text-gray-400'}`} />
              </div>
              <div>
                <p className="text-xs text-gray-400">Stats Carregados</p>
                <p className={`text-xl font-bold ${isLoadingStats ? 'text-yellow-400' : statsError ? 'text-red-400' : Object.keys(matchStats).length > 0 ? 'text-emerald-400' : 'text-gray-400'}`}>
                  {isLoadingStats ? '...' : Object.keys(matchStats).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Erro ao carregar stats */}
      {statsError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-400">
                {apiDisabled ? 'API de estatísticas desabilitada' : 'Erro ao carregar estatísticas'}
              </p>
              <p className="text-xs text-red-300/70 mt-1">{statsError}</p>
              {apiDisabled && (
                <p className="text-xs text-gray-400 mt-2">
                  Verifique se a FOOTBALL_API_KEY está configurada corretamente no Vercel.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Debug: mostrar status detalhado - só quando há stats carregados */}
      {Object.keys(matchStats).length > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
          <div className="text-xs text-blue-300">
            <p className="font-medium mb-1">Debug Stats:</p>
            <p>Jogos com stats: {Object.keys(matchStats).length}</p>
            <p>Sugestões com form: {suggestions.filter(s => s.homeForm || s.awayForm).length}/{suggestions.length}</p>
          </div>
        </div>
      )}

      {/* Lista de Sugestões */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : suggestions.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            Sugestões Baseadas no Seu Histórico
          </h2>

          {suggestions.map((suggestion, index) => (
            <Card
              key={`${suggestion.match.id}-${index}`}
              className={`border ${getConfidenceBg(suggestion.confidence)}`}
            >
              <CardContent className="p-5">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  {/* Informações do jogo */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs mb-2">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-400">{suggestion.match.time}</span>
                      <span className="text-gray-600">•</span>
                      <span className="text-gray-400">{suggestion.match.league}</span>
                      {canBetOn(suggestion.match) ? (
                        <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-medium">
                          Disponível
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-gray-700 text-gray-400 rounded-full text-[10px] font-medium">
                          {suggestion.match.statusShort === 'FT' ? 'Encerrado' : 'Em andamento'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-white font-medium">{suggestion.match.homeTeam}</span>
                      <span className="text-gray-500">vs</span>
                      <span className="text-white font-medium">{suggestion.match.awayTeam}</span>
                    </div>

                    {/* Sugestão de aposta */}
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm text-gray-300">Sugestão:</span>
                      <span className="text-sm font-medium text-emerald-400">
                        {suggestion.suggestedBetTypeLabel}
                      </span>
                    </div>

                    {/* Razões */}
                    <div className="space-y-1.5">
                      {suggestion.reasons.map((reason, i) => (
                        <div key={i} className="flex items-start gap-2 text-sm text-gray-400">
                          <ChevronRight className="w-4 h-4 mt-0.5 text-gray-500 flex-shrink-0" />
                          <span>{reason}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Indicador de confiança */}
                  <div className="flex flex-col items-center justify-center lg:w-32">
                    <div
                      className={`text-3xl font-bold ${getConfidenceColor(suggestion.confidence)}`}
                    >
                      {Math.round(suggestion.confidence)}%
                    </div>
                    <div className="text-xs text-gray-500 text-center">Confiança</div>
                    <div className="text-xs text-gray-600 mt-1">
                      {suggestion.relevantHistory.totalRelevantBets} apostas analisadas
                    </div>
                  </div>
                </div>

                {/* Forma recente dos times (dados da API) */}
                {((suggestion.homeForm && suggestion.homeForm.form.length > 0) ||
                  (suggestion.awayForm && suggestion.awayForm.form.length > 0)) && (
                  <div className="mt-4 pt-4 border-t border-gray-800">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-medium text-gray-300">
                        Forma Recente (últimos 5 jogos)
                      </span>
                      {isLoadingStats && (
                        <RefreshCw className="w-3 h-3 text-gray-500 animate-spin" />
                      )}
                    </div>
                    <div className="space-y-2">
                      {suggestion.homeForm && suggestion.homeForm.form.length > 0 && (
                        <FormDisplay form={suggestion.homeForm} teamName={suggestion.match.homeTeam} />
                      )}
                      {suggestion.awayForm && suggestion.awayForm.form.length > 0 && (
                        <FormDisplay form={suggestion.awayForm} teamName={suggestion.match.awayTeam} />
                      )}
                    </div>
                  </div>
                )}

                {/* Detalhes do histórico */}
                <div className="mt-4 pt-4 border-t border-gray-800">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    {suggestion.relevantHistory.teamAWinRate !== undefined && (
                      <div className="bg-gray-800/50 rounded-lg p-2">
                        <div className="text-gray-500 mb-1">{suggestion.match.homeTeam}</div>
                        <div
                          className={
                            suggestion.relevantHistory.teamAWinRate >= 50
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }
                        >
                          {formatPercentage(suggestion.relevantHistory.teamAWinRate)} win rate
                        </div>
                      </div>
                    )}
                    {suggestion.relevantHistory.teamBWinRate !== undefined && (
                      <div className="bg-gray-800/50 rounded-lg p-2">
                        <div className="text-gray-500 mb-1">{suggestion.match.awayTeam}</div>
                        <div
                          className={
                            suggestion.relevantHistory.teamBWinRate >= 50
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }
                        >
                          {formatPercentage(suggestion.relevantHistory.teamBWinRate)} win rate
                        </div>
                      </div>
                    )}
                    {suggestion.relevantHistory.championshipWinRate !== undefined && (
                      <div className="bg-gray-800/50 rounded-lg p-2">
                        <div className="text-gray-500 mb-1">{suggestion.match.league}</div>
                        <div
                          className={
                            suggestion.relevantHistory.championshipWinRate >= 50
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }
                        >
                          {formatPercentage(suggestion.relevantHistory.championshipWinRate)} win
                          rate
                        </div>
                      </div>
                    )}
                    {suggestion.betTypeStats && suggestion.betTypeStats.totalBets >= 5 && (
                      <div className="bg-gray-800/50 rounded-lg p-2">
                        <div className="text-gray-500 mb-1">{suggestion.suggestedBetTypeLabel}</div>
                        <div
                          className={
                            suggestion.betTypeStats.winRate >= 50
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }
                        >
                          {formatPercentage(suggestion.betTypeStats.winRate)} win rate
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : matches.length > 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Nenhuma sugestão para hoje
            </h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Não encontramos jogos com histórico relevante no seu perfil de apostas.
              Continue registrando suas apostas para obter sugestões mais precisas.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Nenhum jogo encontrado
            </h3>
            <p className="text-gray-400">
              Não há jogos agendados para a data selecionada.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <Card className="bg-gray-800/30 border-gray-700/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-gray-400">
              <p className="font-medium text-gray-300 mb-1">Aviso Importante</p>
              <p>
                As sugestões são baseadas exclusivamente no seu histórico de apostas e não
                garantem resultados. O desempenho passado não é indicativo de resultados
                futuros. Aposte com responsabilidade.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dicas para melhorar sugestões */}
      {bets.length + combinedBets.length < 20 && (
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-300 mb-1">Melhore suas sugestões</p>
                <p className="text-gray-400">
                  Você tem {bets.length + combinedBets.length} apostas finalizadas. Com mais
                  apostas registradas, as sugestões se tornarão mais precisas. Recomendamos ao
                  menos 20 apostas finalizadas por time/campeonato para análises mais confiáveis.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default function PalpitesPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <PalpitesContent />
      </div>
    </MainLayout>
  );
}
