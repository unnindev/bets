'use client';

import { useEffect, useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { formatPercentage } from '@/lib/constants';
import {
  Star,
  AlertCircle,
  RefreshCw,
  Trophy,
  Users,
  Calendar,
  Clock,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import type { Bet, CombinedBet } from '@/types';
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
}

interface ChampionshipHistory {
  name: string;
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
}

// Jogo em destaque - tem times que o usuário aposta frequentemente
interface Highlight {
  match: SimpleMatch;
  homeTeamStats?: TeamHistory;
  awayTeamStats?: TeamHistory;
  championshipStats?: ChampionshipHistory;
  totalBetsWithTeams: number;
}

function DestaquesContent() {
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

    // Buscar todas as apostas finalizadas da carteira
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
    return match.statusShort === 'NS' || match.statusShort === 'TBD';
  };

  // Calcular estatísticas do histórico
  const historyStats = useMemo(() => {
    const teamStats: Record<string, TeamHistory> = {};
    const championshipStats: Record<string, ChampionshipHistory> = {};

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
        };
      }
      championshipStats[champ].totalBets++;
      if (isWin) championshipStats[champ].wins++;
      else championshipStats[champ].losses++;
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
          };
        }
        championshipStats[champ].totalBets++;
        if (isWin) championshipStats[champ].wins++;
        else championshipStats[champ].losses++;
      });
    });

    // Calcular win rates
    Object.values(teamStats).forEach((stat) => {
      stat.winRate = stat.totalBets > 0 ? (stat.wins / stat.totalBets) * 100 : 0;
    });

    Object.values(championshipStats).forEach((stat) => {
      stat.winRate = stat.totalBets > 0 ? (stat.wins / stat.totalBets) * 100 : 0;
    });

    return { teams: teamStats, championships: championshipStats };
  }, [bets, combinedBets]);

  // Filtrar jogos em destaque (que têm times com histórico)
  const highlights = useMemo(() => {
    const result: Highlight[] = [];

    matches.forEach((match) => {
      const homeTeamStats = historyStats.teams[match.homeTeam];
      const awayTeamStats = historyStats.teams[match.awayTeam];
      const champStats = historyStats.championships[match.league];

      // Só mostrar se tiver histórico com pelo menos um time
      const hasHomeHistory = homeTeamStats && homeTeamStats.totalBets >= 1;
      const hasAwayHistory = awayTeamStats && awayTeamStats.totalBets >= 1;

      if (!hasHomeHistory && !hasAwayHistory) {
        return; // Pular jogos sem histórico
      }

      const totalBetsWithTeams =
        (homeTeamStats?.totalBets || 0) + (awayTeamStats?.totalBets || 0);

      result.push({
        match,
        homeTeamStats: hasHomeHistory ? homeTeamStats : undefined,
        awayTeamStats: hasAwayHistory ? awayTeamStats : undefined,
        championshipStats: champStats && champStats.totalBets >= 1 ? champStats : undefined,
        totalBetsWithTeams,
      });
    });

    // Ordenar por total de apostas com esses times (mais apostados primeiro)
    return result.sort((a, b) => b.totalBetsWithTeams - a.totalBetsWithTeams);
  }, [matches, historyStats]);

  // Estatísticas gerais do dia
  const dayStats = useMemo(() => {
    return {
      totalMatches: matches.length,
      highlightedMatches: highlights.length,
    };
  }, [matches, highlights]);

  const isLoading = walletLoading || isLoadingHistory || isLoadingMatches;

  return (
    <>
      {/* Header com seletor de data */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Destaques</h1>
          <p className="text-gray-400">
            Jogos do dia com times que você aposta frequentemente
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <div className="p-2 bg-yellow-500/10 rounded-lg">
                <Star className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Em Destaque</p>
                <p className="text-xl font-bold text-yellow-400">{dayStats.highlightedMatches}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Destaques */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : highlights.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" />
            Jogos com Times que Você Aposta
          </h2>

          {highlights.map((highlight, index) => (
            <Card
              key={`${highlight.match.id}-${index}`}
              className="border border-gray-700 hover:border-gray-600 transition"
            >
              <CardContent className="p-5">
                {/* Informações do jogo */}
                <div className="flex items-center gap-2 text-xs mb-3">
                  <Clock className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-400">{highlight.match.time}</span>
                  <span className="text-gray-600">•</span>
                  <span className="text-gray-400">{highlight.match.league}</span>
                  {canBetOn(highlight.match) ? (
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-medium">
                      Disponível
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-gray-700 text-gray-400 rounded-full text-[10px] font-medium">
                      {highlight.match.statusShort === 'FT' ? 'Encerrado' : 'Em andamento'}
                    </span>
                  )}
                </div>

                {/* Times */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-white font-medium text-lg">{highlight.match.homeTeam}</span>
                    <span className="text-gray-500">vs</span>
                    <span className="text-white font-medium text-lg">{highlight.match.awayTeam}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {highlight.totalBetsWithTeams} apostas com esses times
                  </div>
                </div>

                {/* Estatísticas dos times */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Time da casa */}
                  {highlight.homeTeamStats && (
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">{highlight.match.homeTeam}</span>
                        {highlight.homeTeamStats.winRate >= 50 ? (
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`text-2xl font-bold ${
                            highlight.homeTeamStats.winRate >= 50
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }`}
                        >
                          {formatPercentage(highlight.homeTeamStats.winRate)}
                        </span>
                        <span className="text-xs text-gray-500">win rate</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {highlight.homeTeamStats.wins}V / {highlight.homeTeamStats.losses}D em{' '}
                        {highlight.homeTeamStats.totalBets} apostas
                      </div>
                    </div>
                  )}

                  {/* Time visitante */}
                  {highlight.awayTeamStats && (
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">{highlight.match.awayTeam}</span>
                        {highlight.awayTeamStats.winRate >= 50 ? (
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`text-2xl font-bold ${
                            highlight.awayTeamStats.winRate >= 50
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }`}
                        >
                          {formatPercentage(highlight.awayTeamStats.winRate)}
                        </span>
                        <span className="text-xs text-gray-500">win rate</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {highlight.awayTeamStats.wins}V / {highlight.awayTeamStats.losses}D em{' '}
                        {highlight.awayTeamStats.totalBets} apostas
                      </div>
                    </div>
                  )}

                  {/* Campeonato */}
                  {highlight.championshipStats && (
                    <div className="bg-gray-800/50 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-400">{highlight.match.league}</span>
                        {highlight.championshipStats.winRate >= 50 ? (
                          <TrendingUp className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <TrendingDown className="w-4 h-4 text-red-400" />
                        )}
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span
                          className={`text-2xl font-bold ${
                            highlight.championshipStats.winRate >= 50
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }`}
                        >
                          {formatPercentage(highlight.championshipStats.winRate)}
                        </span>
                        <span className="text-xs text-gray-500">win rate</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {highlight.championshipStats.wins}V / {highlight.championshipStats.losses}D em{' '}
                        {highlight.championshipStats.totalBets} apostas
                      </div>
                    </div>
                  )}
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
              Nenhum destaque para este dia
            </h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Não encontramos jogos com times que você costuma apostar.
              Continue registrando suas apostas para ver mais destaques.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-8 text-center">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-white mb-2">
              Selecione uma data
            </h3>
            <p className="text-gray-400 max-w-md mx-auto">
              Use o seletor de data acima para buscar os jogos do dia.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default function DestaquesPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <DestaquesContent />
      </div>
    </MainLayout>
  );
}
