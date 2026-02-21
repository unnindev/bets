'use client';

import { useEffect, useState, useMemo } from 'react';
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
import type { SimpleMatch } from '@/types/football';

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
}

function PalpitesContent() {
  const { selectedWalletId, isLoading: walletLoading } = useWallet();
  const [matches, setMatches] = useState<SimpleMatch[]>([]);
  const [bets, setBets] = useState<Bet[]>([]);
  const [combinedBets, setCombinedBets] = useState<CombinedBet[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

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

  // Verificar se um jogo ainda pode ser apostado
  const canBetOn = (match: SimpleMatch) => {
    return match.status === 'NS' || match.status === 'TBD';
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

      // Verificar se temos dados relevantes
      const hasTeamAHistory = teamAStats && teamAStats.totalBets >= 3;
      const hasTeamBHistory = teamBStats && teamBStats.totalBets >= 3;
      const hasChampHistory = champStats && champStats.totalBets >= 3;

      if (!hasTeamAHistory && !hasTeamBHistory && !hasChampHistory) {
        return; // Pular jogos sem histórico relevante
      }

      const reasons: string[] = [];
      let totalRelevantBets = 0;
      let weightedWinRate = 0;
      let weightSum = 0;

      // Analisar time da casa
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

      // Analisar time visitante
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

      // Calcular confiança média ponderada
      const confidence = weightSum > 0 ? weightedWinRate / weightSum : 0;

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

        // Se time da casa tem win rate muito alto, sugerir vitória dele
        if (hasTeamAHistory && teamAStats.winRate >= 65) {
          suggestedBetType = 'team_a';
          reasons.unshift(`Alta taxa de acerto apostando em jogos do ${match.homeTeam}`);
        }
        // Se time visitante tem win rate muito alto
        else if (hasTeamBHistory && teamBStats.winRate >= 65) {
          suggestedBetType = 'team_b';
          reasons.unshift(`Alta taxa de acerto apostando em jogos do ${match.awayTeam}`);
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
        });
      }
    });

    // Ordenar por confiança
    return result.sort((a, b) => b.confidence - a.confidence);
  }, [matches, historyStats]);

  // Estatísticas gerais do dia
  const dayStats = useMemo(() => {
    return {
      totalMatches: matches.length,
      matchesWithHistory: suggestions.length,
      highConfidence: suggestions.filter((s) => s.confidence >= 65).length,
    };
  }, [matches, suggestions]);

  const isLoading = walletLoading || isLoadingHistory || isLoadingMatches;

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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
      </div>

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
                          {suggestion.match.status === 'FT' ? 'Encerrado' : 'Em andamento'}
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
