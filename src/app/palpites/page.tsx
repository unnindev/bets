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
    loadingMatchIdsRef.current.clear(); // Limpar ref de loading
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
            loadingMatchIdsRef.current.delete(match.id);
          }
        } catch (error) {
          console.error(`Erro ao carregar stats do jogo ${match.id}:`, error);
          errors.push(`${match.homeTeam} vs ${match.awayTeam}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
          loadingMatchIdsRef.current.delete(match.id);
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
      setStatsError(errors.join('; '));
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
      let totalRelevantBets = 0;
      let weightedWinRate = 0;
      let weightSum = 0;

      // Analisar time da casa (histórico do usuário)
      if (hasTeamAHistory && teamAStats.winRate >= 50) {
        const weight = Math.min(teamAStats.totalBets / 10, 1);
        weightedWinRate += teamAStats.winRate * weight;
        weightSum += weight;
        totalRelevantBets += teamAStats.totalBets;

        if (teamAStats.winRate >= 60) {
          reasons.push(
            `${match.homeTeam}: ${formatPercentage(teamAStats.winRate)} de acerto em ${teamAStats.totalBets} apostas`
          );
        }
      }

      // Analisar time visitante (histórico do usuário)
      if (hasTeamBHistory && teamBStats.winRate >= 50) {
        const weight = Math.min(teamBStats.totalBets / 10, 1);
        weightedWinRate += teamBStats.winRate * weight;
        weightSum += weight;
        totalRelevantBets += teamBStats.totalBets;

        if (teamBStats.winRate >= 60) {
          reasons.push(
            `${match.awayTeam}: ${formatPercentage(teamBStats.winRate)} de acerto em ${teamBStats.totalBets} apostas`
          );
        }
      }

      // Analisar campeonato
      if (hasChampHistory && champStats.winRate >= 50) {
        const weight = Math.min(champStats.totalBets / 15, 1);
        weightedWinRate += champStats.winRate * weight;
        weightSum += weight;
        totalRelevantBets += champStats.totalBets;

        if (champStats.winRate >= 55) {
          reasons.push(
            `${match.league}: ${formatPercentage(champStats.winRate)} de acerto em ${champStats.totalBets} apostas`
          );
        }
      }

      // Analisar dados da API (forma recente dos times)
      let homeFormScore = 0;
      let awayFormScore = 0;

      if (apiStats?.homeForm && apiStats.homeForm.form.length > 0) {
        const homeWins = apiStats.homeForm.wins;
        const homeTotal = apiStats.homeForm.form.length;
        homeFormScore = (homeWins / homeTotal) * 100;

        if (homeWins >= 3) {
          reasons.push(
            `${match.homeTeam} venceu ${homeWins} dos últimos ${homeTotal} jogos`
          );
        } else if (homeWins <= 1 && apiStats.homeForm.losses >= 3) {
          reasons.push(
            `⚠️ Atenção: ${match.homeTeam} perdeu ${apiStats.homeForm.losses} dos últimos ${homeTotal} jogos`
          );
        }
      }

      if (apiStats?.awayForm && apiStats.awayForm.form.length > 0) {
        const awayWins = apiStats.awayForm.wins;
        const awayTotal = apiStats.awayForm.form.length;
        awayFormScore = (awayWins / awayTotal) * 100;

        if (awayWins >= 3) {
          reasons.push(
            `${match.awayTeam} venceu ${awayWins} dos últimos ${awayTotal} jogos`
          );
        } else if (awayWins <= 1 && apiStats.awayForm.losses >= 3) {
          reasons.push(
            `⚠️ Atenção: ${match.awayTeam} perdeu ${apiStats.awayForm.losses} dos últimos ${awayTotal} jogos`
          );
        }
      }

      // Analisar confrontos diretos (H2H)
      if (apiStats?.h2h && apiStats.h2h.matches > 0) {
        const h2h = apiStats.h2h;
        if (h2h.team1Wins > h2h.team2Wins + 1) {
          reasons.push(
            `Histórico de confrontos: ${h2h.team1Name} venceu ${h2h.team1Wins} de ${h2h.matches} jogos`
          );
        } else if (h2h.team2Wins > h2h.team1Wins + 1) {
          reasons.push(
            `Histórico de confrontos: ${h2h.team2Name} venceu ${h2h.team2Wins} de ${h2h.matches} jogos`
          );
        }
      }

      // Ajustar confiança com dados da API
      if (hasApiData) {
        // Bonus/penalidade baseado na forma recente
        const formDiff = homeFormScore - awayFormScore;

        // Se você tem bom histórico com time da casa MAS ele está em má fase, reduzir confiança
        if (hasTeamAHistory && teamAStats.winRate >= 60 && homeFormScore < 40) {
          weightedWinRate -= 10; // Penalidade por má fase
          reasons.push(`⚠️ ${match.homeTeam} em má fase recente`);
        }

        // Se você tem bom histórico com visitante MAS ele está em má fase
        if (hasTeamBHistory && teamBStats.winRate >= 60 && awayFormScore < 40) {
          weightedWinRate -= 10;
          reasons.push(`⚠️ ${match.awayTeam} em má fase recente`);
        }

        // Bônus se o time está em boa fase E você tem bom histórico
        if (hasTeamAHistory && teamAStats.winRate >= 55 && homeFormScore >= 60) {
          weightedWinRate += 5;
        }
        if (hasTeamBHistory && teamBStats.winRate >= 55 && awayFormScore >= 60) {
          weightedWinRate += 5;
        }
      }

      // Calcular confiança média ponderada
      let confidence = weightSum > 0 ? weightedWinRate / weightSum : 0;

      // Se não tem histórico mas tem dados da API, usar só os dados da API
      if (!hasTeamAHistory && !hasTeamBHistory && !hasChampHistory && hasApiData) {
        confidence = Math.max(homeFormScore, awayFormScore) * 0.7; // Reduzir um pouco pois não tem histórico pessoal
      }

      // Garantir que confiança está entre 0 e 100
      confidence = Math.max(0, Math.min(100, confidence));

      // Só sugerir se tivermos confiança mínima e razões
      if (confidence >= 50 && reasons.length > 0) {
        // Determinar melhor tipo de aposta baseado no histórico
        let suggestedBetType: BetType = 'team_a';
        let bestWinRate = 0;

        // Verificar qual tipo de aposta tem melhor histórico geral
        Object.values(historyStats.betTypes).forEach((stat) => {
          if (stat.totalBets >= 5 && stat.winRate > bestWinRate) {
            bestWinRate = stat.winRate;
            suggestedBetType = stat.type;
          }
        });

        // Se time da casa tem win rate muito alto E está em boa forma
        if (hasTeamAHistory && teamAStats.winRate >= 65 && homeFormScore >= 50) {
          suggestedBetType = 'team_a';
          reasons.unshift(`Alta taxa de acerto apostando em jogos do ${match.homeTeam}`);
        }
        // Se time visitante tem win rate muito alto E está em boa forma
        else if (hasTeamBHistory && teamBStats.winRate >= 65 && awayFormScore >= 50) {
          suggestedBetType = 'team_b';
          reasons.unshift(`Alta taxa de acerto apostando em jogos do ${match.awayTeam}`);
        }
        // Se não tem histórico mas time da casa está muito bem
        else if (!hasTeamAHistory && !hasTeamBHistory && homeFormScore >= 80) {
          suggestedBetType = 'team_a';
        }
        // Se não tem histórico mas visitante está muito bem
        else if (!hasTeamAHistory && !hasTeamBHistory && awayFormScore >= 80) {
          suggestedBetType = 'team_b';
        }

        const betTypeLabel =
          BET_TYPES.find((t) => t.value === suggestedBetType)?.label || suggestedBetType;

        result.push({
          match,
          confidence,
          reasons,
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
    if (matches.length === 0 || isLoadingStats) return;

    // Ligas principais para priorizar
    const mainLeagueIds = [71, 72, 73, 39, 140, 135, 78, 61, 2, 3, 13, 11];

    // Filtrar jogos que ainda não têm stats, não estão sendo carregados, e têm IDs de times
    const matchesWithoutStats = matches.filter(
      (m) =>
        !matchStats[m.id] &&
        !loadingMatchIdsRef.current.has(m.id) &&
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
  }, [matches, matchStats, isLoadingStats, loadTeamStats]);

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
              <p className="text-sm font-medium text-red-400">Erro ao carregar estatísticas da API</p>
              <p className="text-xs text-red-300/70 mt-1">{statsError}</p>
            </div>
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
