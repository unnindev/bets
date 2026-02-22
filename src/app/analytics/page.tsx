'use client';

import { useEffect, useState, useMemo } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { createClient } from '@/lib/supabase/client';
import {
  formatCurrency,
  formatPercentage,
  BET_TYPES,
  RESULT_COLORS,
} from '@/lib/constants';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Target,
  Users,
  Trophy,
  Calendar,
  Filter,
  ChevronDown,
  ChevronUp,
  Landmark,
  Percent,
  Lightbulb,
  Flame,
  Zap,
  ArrowRight,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
  Area,
  AreaChart,
} from 'recharts';
import Link from 'next/link';
import { useWallet } from '@/contexts/WalletContext';
import type { Bet, CombinedBet, CombinedBetItem } from '@/types';

interface TeamStats {
  name: string;
  totalBets: number;
  wins: number;
  losses: number;
  pending: number;
  winRate: number;
  totalBet: number;
  totalReturn: number;
  profit: number;
  roi: number;
}

interface BetTypeStats {
  type: string;
  label: string;
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  totalBet: number;
  profit: number;
  roi: number;
}

interface ChampionshipStats {
  name: string;
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  totalBet: number;
  profit: number;
  roi: number;
}

interface DayOfWeekStats {
  day: string;
  dayIndex: number;
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  profit: number;
}

interface OddsRangeStats {
  range: string;
  totalBets: number;
  wins: number;
  losses: number;
  winRate: number;
  profit: number;
}

const DAYS_OF_WEEK = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

const CHART_COLORS = [
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#F59E0B',
  '#EF4444',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
];

function AnalyticsContent() {
  const { selectedWalletId, selectedWallet, isLoading: walletLoading } = useWallet();
  const [bets, setBets] = useState<Bet[]>([]);
  const [combinedBets, setCombinedBets] = useState<CombinedBet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filtros
  const [selectedTeam, setSelectedTeam] = useState<string>('all');
  const [selectedChampionship, setSelectedChampionship] = useState<string>('all');
  const [selectedBetType, setSelectedBetType] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [quickPeriod, setQuickPeriod] = useState<string>('all');

  // Seções colapsáveis
  const [showTeamStats, setShowTeamStats] = useState(true);
  const [showBetTypeStats, setShowBetTypeStats] = useState(true);
  const [showChampionshipStats, setShowChampionshipStats] = useState(true);
  const [showTimeStats, setShowTimeStats] = useState(true);
  const [showOddsStats, setShowOddsStats] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    if (selectedWalletId) {
      loadData();
    }
  }, [selectedWalletId]);

  const loadData = async () => {
    if (!selectedWalletId) return;

    setIsLoading(true);

    const [betsRes, combinedRes] = await Promise.all([
      supabase
        .from('bets')
        .select('*')
        .eq('wallet_id', selectedWalletId)
        .order('match_date', { ascending: false }),
      supabase
        .from('combined_bets')
        .select('*, items:combined_bet_items(*)')
        .eq('wallet_id', selectedWalletId)
        .order('match_date', { ascending: false }),
    ]);

    if (betsRes.data) setBets(betsRes.data);
    if (combinedRes.data) setCombinedBets(combinedRes.data);

    setIsLoading(false);
  };

  // Extrair listas únicas para os filtros
  const { teams, championships } = useMemo(() => {
    const teamsSet = new Set<string>();
    const championshipsSet = new Set<string>();

    bets.forEach((bet) => {
      teamsSet.add(bet.team_a);
      teamsSet.add(bet.team_b);
      championshipsSet.add(bet.championship);
    });

    combinedBets.forEach((cb) => {
      cb.items?.forEach((item) => {
        teamsSet.add(item.team_a);
        teamsSet.add(item.team_b);
        championshipsSet.add(item.championship);
      });
    });

    return {
      teams: Array.from(teamsSet).sort(),
      championships: Array.from(championshipsSet).sort(),
    };
  }, [bets, combinedBets]);

  // Filtrar apostas
  const filteredData = useMemo(() => {
    let filteredBets = [...bets];
    let filteredCombined = [...combinedBets];

    // Filtro por time
    if (selectedTeam !== 'all') {
      filteredBets = filteredBets.filter(
        (b) => b.team_a === selectedTeam || b.team_b === selectedTeam
      );
      filteredCombined = filteredCombined.filter((cb) =>
        cb.items?.some(
          (item) => item.team_a === selectedTeam || item.team_b === selectedTeam
        )
      );
    }

    // Filtro por campeonato
    if (selectedChampionship !== 'all') {
      filteredBets = filteredBets.filter(
        (b) => b.championship === selectedChampionship
      );
      filteredCombined = filteredCombined.filter((cb) =>
        cb.items?.some((item) => item.championship === selectedChampionship)
      );
    }

    // Filtro por tipo de aposta
    if (selectedBetType !== 'all') {
      filteredBets = filteredBets.filter((b) => b.bet_type === selectedBetType);
      filteredCombined = filteredCombined.filter((cb) =>
        cb.items?.some((item) => item.bet_type === selectedBetType)
      );
    }

    // Filtro por data
    if (dateFrom) {
      filteredBets = filteredBets.filter((b) => b.match_date >= dateFrom);
      filteredCombined = filteredCombined.filter(
        (cb) => cb.match_date >= dateFrom
      );
    }
    if (dateTo) {
      filteredBets = filteredBets.filter((b) => b.match_date <= dateTo);
      filteredCombined = filteredCombined.filter(
        (cb) => cb.match_date <= dateTo
      );
    }

    return { bets: filteredBets, combined: filteredCombined };
  }, [
    bets,
    combinedBets,
    selectedTeam,
    selectedChampionship,
    selectedBetType,
    dateFrom,
    dateTo,
  ]);

  // Estatísticas gerais filtradas
  const generalStats = useMemo(() => {
    const allBets = filteredData.bets;
    const allCombined = filteredData.combined;

    const finishedBets = allBets.filter((b) => b.result !== 'pending');
    const finishedCombined = allCombined.filter((cb) => cb.result !== 'pending');

    const totalBets = allBets.length + allCombined.length;
    const wins =
      allBets.filter((b) => b.result === 'win').length +
      allCombined.filter((cb) => cb.result === 'win').length;
    const losses =
      allBets.filter((b) => b.result === 'loss').length +
      allCombined.filter((cb) => cb.result === 'loss').length;
    const pending =
      allBets.filter((b) => b.result === 'pending').length +
      allCombined.filter((cb) => cb.result === 'pending').length;

    const totalBet =
      finishedBets.reduce((sum, b) => sum + Number(b.amount), 0) +
      finishedCombined.reduce((sum, cb) => sum + Number(cb.amount), 0);

    const totalReturn =
      finishedBets.reduce((sum, b) => sum + Number(b.return_amount), 0) +
      finishedCombined.reduce((sum, cb) => sum + Number(cb.return_amount), 0);

    const profit = totalReturn - totalBet;
    const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;
    const roi = totalBet > 0 ? (profit / totalBet) * 100 : 0;

    // ROI sobre capital
    const initialBalance = selectedWallet ? Number(selectedWallet.initial_balance) : 0;
    const currentBalance = selectedWallet ? Number(selectedWallet.balance) : 0;
    const capitalProfit = currentBalance - initialBalance;
    const roiCapital = initialBalance > 0 ? (capitalProfit / initialBalance) * 100 : 0;

    return { totalBets, wins, losses, pending, totalBet, totalReturn, profit, winRate, roi, roiCapital, initialBalance, currentBalance };
  }, [filteredData, selectedWallet]);

  // Estatísticas por time
  const teamStats = useMemo(() => {
    const stats: Record<string, TeamStats> = {};

    filteredData.bets.forEach((bet) => {
      [bet.team_a, bet.team_b].forEach((team) => {
        if (!stats[team]) {
          stats[team] = {
            name: team,
            totalBets: 0,
            wins: 0,
            losses: 0,
            pending: 0,
            winRate: 0,
            totalBet: 0,
            totalReturn: 0,
            profit: 0,
            roi: 0,
          };
        }
        stats[team].totalBets++;
        if (bet.result === 'win') stats[team].wins++;
        else if (bet.result === 'loss') stats[team].losses++;
        else if (bet.result === 'pending') stats[team].pending++;

        if (bet.result !== 'pending') {
          stats[team].totalBet += Number(bet.amount);
          stats[team].totalReturn += Number(bet.return_amount);
        }
      });
    });

    filteredData.combined.forEach((cb) => {
      cb.items?.forEach((item) => {
        [item.team_a, item.team_b].forEach((team) => {
          if (!stats[team]) {
            stats[team] = {
              name: team,
              totalBets: 0,
              wins: 0,
              losses: 0,
              pending: 0,
              winRate: 0,
              totalBet: 0,
              totalReturn: 0,
              profit: 0,
              roi: 0,
            };
          }
          stats[team].totalBets++;
          if (cb.result === 'win') stats[team].wins++;
          else if (cb.result === 'loss') stats[team].losses++;
          else if (cb.result === 'pending') stats[team].pending++;

          if (cb.result !== 'pending') {
            // Dividir o valor da aposta combinada pelos itens
            const itemCount = cb.items?.length || 1;
            stats[team].totalBet += Number(cb.amount) / itemCount;
            stats[team].totalReturn += Number(cb.return_amount) / itemCount;
          }
        });
      });
    });

    // Calcular win rate, profit e ROI
    Object.values(stats).forEach((stat) => {
      const finished = stat.wins + stat.losses;
      stat.winRate = finished > 0 ? (stat.wins / finished) * 100 : 0;
      stat.profit = stat.totalReturn - stat.totalBet;
      stat.roi = stat.totalBet > 0 ? (stat.profit / stat.totalBet) * 100 : 0;
    });

    return Object.values(stats).sort((a, b) => b.profit - a.profit);
  }, [filteredData]);

  // Estatísticas por tipo de aposta
  const betTypeStats = useMemo(() => {
    const stats: Record<string, BetTypeStats> = {};

    BET_TYPES.forEach(({ value, label }) => {
      stats[value] = {
        type: value,
        label,
        totalBets: 0,
        wins: 0,
        losses: 0,
        winRate: 0,
        totalBet: 0,
        profit: 0,
        roi: 0,
      };
    });

    filteredData.bets.forEach((bet) => {
      const type = bet.bet_type;
      if (stats[type]) {
        stats[type].totalBets++;
        if (bet.result === 'win') stats[type].wins++;
        else if (bet.result === 'loss') stats[type].losses++;

        if (bet.result !== 'pending') {
          stats[type].totalBet += Number(bet.amount);
          stats[type].profit += Number(bet.return_amount) - Number(bet.amount);
        }
      }
    });

    filteredData.combined.forEach((cb) => {
      cb.items?.forEach((item) => {
        const type = item.bet_type;
        if (stats[type]) {
          stats[type].totalBets++;
          if (cb.result === 'win') stats[type].wins++;
          else if (cb.result === 'loss') stats[type].losses++;

          if (cb.result !== 'pending') {
            const itemCount = cb.items?.length || 1;
            stats[type].totalBet += Number(cb.amount) / itemCount;
            stats[type].profit +=
              (Number(cb.return_amount) - Number(cb.amount)) / itemCount;
          }
        }
      });
    });

    // Calcular win rate e ROI
    Object.values(stats).forEach((stat) => {
      const finished = stat.wins + stat.losses;
      stat.winRate = finished > 0 ? (stat.wins / finished) * 100 : 0;
      stat.roi = stat.totalBet > 0 ? (stat.profit / stat.totalBet) * 100 : 0;
    });

    return Object.values(stats)
      .filter((s) => s.totalBets > 0)
      .sort((a, b) => b.profit - a.profit);
  }, [filteredData]);

  // Estatísticas por campeonato
  const championshipStats = useMemo(() => {
    const stats: Record<string, ChampionshipStats> = {};

    filteredData.bets.forEach((bet) => {
      const champ = bet.championship;
      if (!stats[champ]) {
        stats[champ] = {
          name: champ,
          totalBets: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          totalBet: 0,
          profit: 0,
          roi: 0,
        };
      }
      stats[champ].totalBets++;
      if (bet.result === 'win') stats[champ].wins++;
      else if (bet.result === 'loss') stats[champ].losses++;

      if (bet.result !== 'pending') {
        stats[champ].totalBet += Number(bet.amount);
        stats[champ].profit += Number(bet.return_amount) - Number(bet.amount);
      }
    });

    filteredData.combined.forEach((cb) => {
      cb.items?.forEach((item) => {
        const champ = item.championship;
        if (!stats[champ]) {
          stats[champ] = {
            name: champ,
            totalBets: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            totalBet: 0,
            profit: 0,
            roi: 0,
          };
        }
        stats[champ].totalBets++;
        if (cb.result === 'win') stats[champ].wins++;
        else if (cb.result === 'loss') stats[champ].losses++;

        if (cb.result !== 'pending') {
          const itemCount = cb.items?.length || 1;
          stats[champ].totalBet += Number(cb.amount) / itemCount;
          stats[champ].profit +=
            (Number(cb.return_amount) - Number(cb.amount)) / itemCount;
        }
      });
    });

    // Calcular win rate e ROI
    Object.values(stats).forEach((stat) => {
      const finished = stat.wins + stat.losses;
      stat.winRate = finished > 0 ? (stat.wins / finished) * 100 : 0;
      stat.roi = stat.totalBet > 0 ? (stat.profit / stat.totalBet) * 100 : 0;
    });

    return Object.values(stats).sort((a, b) => b.profit - a.profit);
  }, [filteredData]);

  // Estatísticas por dia da semana
  const dayOfWeekStats = useMemo(() => {
    const stats: DayOfWeekStats[] = DAYS_OF_WEEK.map((day, index) => ({
      day,
      dayIndex: index,
      totalBets: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      profit: 0,
    }));

    filteredData.bets.forEach((bet) => {
      const date = new Date(bet.match_date + 'T12:00:00');
      const dayIndex = date.getDay();
      stats[dayIndex].totalBets++;
      if (bet.result === 'win') stats[dayIndex].wins++;
      else if (bet.result === 'loss') stats[dayIndex].losses++;

      if (bet.result !== 'pending') {
        stats[dayIndex].profit += Number(bet.return_amount) - Number(bet.amount);
      }
    });

    filteredData.combined.forEach((cb) => {
      const date = new Date(cb.match_date + 'T12:00:00');
      const dayIndex = date.getDay();
      stats[dayIndex].totalBets++;
      if (cb.result === 'win') stats[dayIndex].wins++;
      else if (cb.result === 'loss') stats[dayIndex].losses++;

      if (cb.result !== 'pending') {
        stats[dayIndex].profit += Number(cb.return_amount) - Number(cb.amount);
      }
    });

    // Calcular win rate
    stats.forEach((stat) => {
      const finished = stat.wins + stat.losses;
      stat.winRate = finished > 0 ? (stat.wins / finished) * 100 : 0;
    });

    return stats;
  }, [filteredData]);

  // Estatísticas por faixa de odd
  const oddsRangeStats = useMemo(() => {
    const ranges = [
      { label: '1.00 - 1.50', min: 1.0, max: 1.5 },
      { label: '1.51 - 2.00', min: 1.51, max: 2.0 },
      { label: '2.01 - 3.00', min: 2.01, max: 3.0 },
      { label: '3.01 - 5.00', min: 3.01, max: 5.0 },
      { label: '5.01+', min: 5.01, max: Infinity },
    ];

    const stats: OddsRangeStats[] = ranges.map((r) => ({
      range: r.label,
      totalBets: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      profit: 0,
    }));

    const findRangeIndex = (odds: number) => {
      return ranges.findIndex((r) => odds >= r.min && odds <= r.max);
    };

    filteredData.bets.forEach((bet) => {
      const idx = findRangeIndex(Number(bet.odds));
      if (idx >= 0) {
        stats[idx].totalBets++;
        if (bet.result === 'win') stats[idx].wins++;
        else if (bet.result === 'loss') stats[idx].losses++;

        if (bet.result !== 'pending') {
          stats[idx].profit += Number(bet.return_amount) - Number(bet.amount);
        }
      }
    });

    filteredData.combined.forEach((cb) => {
      const idx = findRangeIndex(Number(cb.odds));
      if (idx >= 0) {
        stats[idx].totalBets++;
        if (cb.result === 'win') stats[idx].wins++;
        else if (cb.result === 'loss') stats[idx].losses++;

        if (cb.result !== 'pending') {
          stats[idx].profit += Number(cb.return_amount) - Number(cb.amount);
        }
      }
    });

    // Calcular win rate
    stats.forEach((stat) => {
      const finished = stat.wins + stat.losses;
      stat.winRate = finished > 0 ? (stat.wins / finished) * 100 : 0;
    });

    return stats;
  }, [filteredData]);

  // Times mais apostados
  const mostBettedTeams = useMemo(() => {
    return teamStats.slice().sort((a, b) => b.totalBets - a.totalBets).slice(0, 10);
  }, [teamStats]);

  // Dados para gráfico de pizza de resultados
  const resultsPieData = useMemo(() => {
    return [
      { name: 'Vitórias', value: generalStats.wins, color: '#10B981' },
      { name: 'Derrotas', value: generalStats.losses, color: '#EF4444' },
      { name: 'Pendentes', value: generalStats.pending, color: '#F59E0B' },
    ].filter((d) => d.value > 0);
  }, [generalStats]);

  // Evolução do lucro ao longo do tempo
  const profitEvolution = useMemo(() => {
    const allBetsWithDates = [
      ...filteredData.bets
        .filter((b) => b.result !== 'pending')
        .map((b) => ({
          date: b.match_date,
          profit: Number(b.return_amount) - Number(b.amount),
        })),
      ...filteredData.combined
        .filter((cb) => cb.result !== 'pending')
        .map((cb) => ({
          date: cb.match_date,
          profit: Number(cb.return_amount) - Number(cb.amount),
        })),
    ].sort((a, b) => a.date.localeCompare(b.date));

    // Agrupar por data e acumular
    const byDate: Record<string, number> = {};
    let cumulative = 0;

    allBetsWithDates.forEach(({ date, profit }) => {
      cumulative += profit;
      byDate[date] = cumulative;
    });

    return Object.entries(byDate)
      .map(([date, profit]) => ({
        date: new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        }),
        fullDate: date,
        profit,
      }))
      .slice(-30); // Últimos 30 pontos para não sobrecarregar o gráfico
  }, [filteredData]);

  // Calcular streak atual (sequência de vitórias ou derrotas)
  const currentStreak = useMemo(() => {
    const allResults = [
      ...filteredData.bets
        .filter((b) => b.result !== 'pending')
        .map((b) => ({ date: b.match_date, result: b.result })),
      ...filteredData.combined
        .filter((cb) => cb.result !== 'pending')
        .map((cb) => ({ date: cb.match_date, result: cb.result })),
    ].sort((a, b) => b.date.localeCompare(a.date)); // Mais recente primeiro

    if (allResults.length === 0) return { type: 'none', count: 0 };

    const lastResult = allResults[0].result;
    let count = 0;

    for (const { result } of allResults) {
      if (result === lastResult) {
        count++;
      } else {
        break;
      }
    }

    return { type: lastResult, count };
  }, [filteredData]);

  // Melhor e pior tipo de aposta
  const bestAndWorstBetType = useMemo(() => {
    const filtered = betTypeStats.filter((s) => s.totalBets >= 3);
    if (filtered.length === 0) return { best: null, worst: null };

    const sorted = [...filtered].sort((a, b) => b.winRate - a.winRate);
    return {
      best: sorted[0],
      worst: sorted[sorted.length - 1],
    };
  }, [betTypeStats]);

  // Aplicar filtro rápido de período
  const applyQuickPeriod = (period: string) => {
    setQuickPeriod(period);
    const today = new Date();
    let fromDate = '';

    switch (period) {
      case '7d':
        fromDate = new Date(today.setDate(today.getDate() - 7)).toISOString().split('T')[0];
        break;
      case '30d':
        fromDate = new Date(today.setDate(today.getDate() - 30)).toISOString().split('T')[0];
        break;
      case '90d':
        fromDate = new Date(today.setDate(today.getDate() - 90)).toISOString().split('T')[0];
        break;
      case 'all':
      default:
        fromDate = '';
    }

    setDateFrom(fromDate);
    setDateTo('');
  };

  const clearFilters = () => {
    setSelectedTeam('all');
    setSelectedChampionship('all');
    setSelectedBetType('all');
    setDateFrom('');
    setDateTo('');
    setQuickPeriod('all');
  };

  if (walletLoading || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  const hasFilters =
    selectedTeam !== 'all' ||
    selectedChampionship !== 'all' ||
    selectedBetType !== 'all' ||
    quickPeriod !== 'all' ||
    dateFrom ||
    dateTo;

  return (
    <>
      {/* Filtros */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Filtros</h3>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto text-sm text-gray-400 hover:text-white"
              >
                Limpar filtros
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros rápidos de período */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="text-sm text-gray-400 mr-2">Período:</span>
            {[
              { value: 'all', label: 'Todo período' },
              { value: '7d', label: '7 dias' },
              { value: '30d', label: '30 dias' },
              { value: '90d', label: '90 dias' },
            ].map((period) => (
              <button
                key={period.value}
                onClick={() => applyQuickPeriod(period.value)}
                className={`px-3 py-1 text-sm rounded-full transition ${
                  quickPeriod === period.value
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {period.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Select
              label="Time"
              value={selectedTeam}
              onChange={(e) => setSelectedTeam(e.target.value)}
              options={[
                { value: 'all', label: 'Todos os times' },
                ...teams.map((t) => ({ value: t, label: t })),
              ]}
            />
            <Select
              label="Campeonato"
              value={selectedChampionship}
              onChange={(e) => setSelectedChampionship(e.target.value)}
              options={[
                { value: 'all', label: 'Todos os campeonatos' },
                ...championships.map((c) => ({ value: c, label: c })),
              ]}
            />
            <Select
              label="Tipo de Aposta"
              value={selectedBetType}
              onChange={(e) => setSelectedBetType(e.target.value)}
              options={[
                { value: 'all', label: 'Todos os tipos' },
                ...BET_TYPES.map((t) => ({ value: t.value, label: t.label })),
              ]}
            />
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Data inicial
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setQuickPeriod('custom');
                }}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Data final
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setQuickPeriod('custom');
                }}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Card de Destaques + Streak */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Link para Destaques */}
        <Link href="/palpites">
          <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30 hover:border-yellow-500/50 transition cursor-pointer">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-yellow-500/20 rounded-xl">
                    <Lightbulb className="w-6 h-6 text-yellow-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">Ver Destaques do Dia</h3>
                    <p className="text-sm text-gray-400">
                      Jogos com times que você aposta frequentemente
                    </p>
                  </div>
                </div>
                <ArrowRight className="w-5 h-5 text-yellow-400" />
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Streak atual */}
        <Card className={currentStreak.type === 'win' ? 'bg-emerald-500/5 border-emerald-500/20' : currentStreak.type === 'loss' ? 'bg-red-500/5 border-red-500/20' : ''}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-xl ${currentStreak.type === 'win' ? 'bg-emerald-500/20' : currentStreak.type === 'loss' ? 'bg-red-500/20' : 'bg-gray-800'}`}>
                  {currentStreak.type === 'win' ? (
                    <Flame className="w-6 h-6 text-emerald-400" />
                  ) : currentStreak.type === 'loss' ? (
                    <TrendingDown className="w-6 h-6 text-red-400" />
                  ) : (
                    <Zap className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {currentStreak.type === 'win' ? 'Sequência de Vitórias' : currentStreak.type === 'loss' ? 'Sequência de Derrotas' : 'Nenhuma Sequência'}
                  </h3>
                  <p className="text-sm text-gray-400">
                    {currentStreak.count > 0 ? `${currentStreak.count} apostas consecutivas` : 'Comece a apostar para ver suas sequências'}
                  </p>
                </div>
              </div>
              <div className={`text-3xl font-bold ${currentStreak.type === 'win' ? 'text-emerald-400' : currentStreak.type === 'loss' ? 'text-red-400' : 'text-gray-500'}`}>
                {currentStreak.count > 0 ? currentStreak.count : '-'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo Geral */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-400">Total Apostas</p>
            <p className="text-xl font-bold text-white">{generalStats.totalBets}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-400">Vitórias</p>
            <p className="text-xl font-bold text-emerald-400">{generalStats.wins}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-400">Derrotas</p>
            <p className="text-xl font-bold text-red-400">{generalStats.losses}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-400">Win Rate</p>
            <p className={`text-xl font-bold ${generalStats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatPercentage(generalStats.winRate)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-gray-400">Lucro/Prejuízo</p>
            <p className={`text-xl font-bold ${generalStats.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(generalStats.currentBalance - generalStats.initialBalance)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ROI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">ROI sobre Capital</p>
                <p className={`text-2xl font-bold ${generalStats.roiCapital >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatPercentage(generalStats.roiCapital)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Quanto seu capital inicial cresceu
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  (Saldo Atual - Depositado) / Depositado
                </p>
              </div>
              <div className="p-3 bg-gray-800 rounded-lg">
                <Landmark className="w-5 h-5 text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-400 mb-1">ROI sobre Apostas</p>
                <p className={`text-2xl font-bold ${generalStats.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatPercentage(generalStats.roi)}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Eficiência por real apostado
                </p>
                <p className="text-xs text-gray-600 mt-0.5">
                  Lucro das apostas / Total apostado
                </p>
              </div>
              <div className="p-3 bg-gray-800 rounded-lg">
                <Percent className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Evolução do Lucro */}
      {profitEvolution.length > 1 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-semibold text-white">Evolução do Lucro</h3>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={profitEvolution}>
                  <defs>
                    <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorLoss" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9CA3AF" fontSize={11} />
                  <YAxis stroke="#9CA3AF" fontSize={12} tickFormatter={(v) => formatCurrency(v)} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                    formatter={(value) => [formatCurrency(Number(value)), 'Lucro Acumulado']}
                    labelFormatter={(label) => `Data: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="profit"
                    stroke={profitEvolution[profitEvolution.length - 1]?.profit >= 0 ? '#10B981' : '#EF4444'}
                    fill={profitEvolution[profitEvolution.length - 1]?.profit >= 0 ? 'url(#colorProfit)' : 'url(#colorLoss)'}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráficos de Visão Geral */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pizza de Resultados */}
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold text-white">Distribuição de Resultados</h3>
          </CardHeader>
          <CardContent>
            {resultsPieData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={resultsPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {resultsPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                Nenhuma aposta encontrada
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lucro por Dia da Semana */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-semibold text-white">Lucro por Dia da Semana</h3>
            </div>
          </CardHeader>
          <CardContent>
            {dayOfWeekStats.some((d) => d.totalBets > 0) ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dayOfWeekStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="day" stroke="#9CA3AF" fontSize={11} />
                    <YAxis stroke="#9CA3AF" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1F2937',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                      }}
                      formatter={(value) => [formatCurrency(Number(value)), 'Lucro']}
                    />
                    <Bar
                      dataKey="profit"
                      fill="#10B981"
                      radius={[4, 4, 0, 0]}
                    >
                      {dayOfWeekStats.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.profit >= 0 ? '#10B981' : '#EF4444'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-gray-500">
                Nenhuma aposta encontrada
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Estatísticas por Tipo de Aposta */}
      <Card>
        <CardHeader>
          <button
            onClick={() => setShowBetTypeStats(!showBetTypeStats)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-purple-400" />
              <h3 className="text-lg font-semibold text-white">
                Estatísticas por Tipo de Aposta
              </h3>
            </div>
            {showBetTypeStats ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </CardHeader>
        {showBetTypeStats && (
          <CardContent>
            {betTypeStats.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-gray-400 text-sm border-b border-gray-800">
                      <th className="pb-3 font-medium">Tipo</th>
                      <th className="pb-3 font-medium text-center">Apostas</th>
                      <th className="pb-3 font-medium text-center">V/D</th>
                      <th className="pb-3 font-medium text-center">Win Rate</th>
                      <th className="pb-3 font-medium text-right">Apostado</th>
                      <th className="pb-3 font-medium text-right">Lucro</th>
                      <th className="pb-3 font-medium text-right">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {betTypeStats.map((stat) => (
                      <tr
                        key={stat.type}
                        className="border-b border-gray-800/50 hover:bg-gray-800/30"
                      >
                        <td className="py-3 text-white">{stat.label}</td>
                        <td className="py-3 text-center text-gray-300">
                          {stat.totalBets}
                        </td>
                        <td className="py-3 text-center">
                          <span className="text-emerald-400">{stat.wins}</span>
                          <span className="text-gray-500">/</span>
                          <span className="text-red-400">{stat.losses}</span>
                        </td>
                        <td className="py-3 text-center">
                          <span
                            className={
                              stat.winRate >= 50
                                ? 'text-emerald-400'
                                : 'text-red-400'
                            }
                          >
                            {formatPercentage(stat.winRate)}
                          </span>
                        </td>
                        <td className="py-3 text-right text-gray-300">
                          {formatCurrency(stat.totalBet)}
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={
                              stat.profit >= 0
                                ? 'text-emerald-400'
                                : 'text-red-400'
                            }
                          >
                            {stat.profit >= 0 ? '+' : ''}
                            {formatCurrency(stat.profit)}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={
                              stat.roi >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }
                          >
                            {formatPercentage(stat.roi)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Nenhuma aposta encontrada
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Estatísticas por Faixa de Odd */}
      <Card>
        <CardHeader>
          <button
            onClick={() => setShowOddsStats(!showOddsStats)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-yellow-400" />
              <h3 className="text-lg font-semibold text-white">
                Estatísticas por Faixa de Odd
              </h3>
            </div>
            {showOddsStats ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </CardHeader>
        {showOddsStats && (
          <CardContent>
            {oddsRangeStats.some((s) => s.totalBets > 0) ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-gray-400 text-sm border-b border-gray-800">
                      <th className="pb-3 font-medium">Faixa de Odd</th>
                      <th className="pb-3 font-medium text-center">Apostas</th>
                      <th className="pb-3 font-medium text-center">V/D</th>
                      <th className="pb-3 font-medium text-center">Win Rate</th>
                      <th className="pb-3 font-medium text-right">Lucro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {oddsRangeStats.map((stat) => (
                      <tr
                        key={stat.range}
                        className="border-b border-gray-800/50 hover:bg-gray-800/30"
                      >
                        <td className="py-3 text-white">{stat.range}</td>
                        <td className="py-3 text-center text-gray-300">
                          {stat.totalBets}
                        </td>
                        <td className="py-3 text-center">
                          <span className="text-emerald-400">{stat.wins}</span>
                          <span className="text-gray-500">/</span>
                          <span className="text-red-400">{stat.losses}</span>
                        </td>
                        <td className="py-3 text-center">
                          <span
                            className={
                              stat.winRate >= 50
                                ? 'text-emerald-400'
                                : 'text-red-400'
                            }
                          >
                            {formatPercentage(stat.winRate)}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={
                              stat.profit >= 0
                                ? 'text-emerald-400'
                                : 'text-red-400'
                            }
                          >
                            {stat.profit >= 0 ? '+' : ''}
                            {formatCurrency(stat.profit)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Nenhuma aposta encontrada
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Estatísticas por Time */}
      <Card>
        <CardHeader>
          <button
            onClick={() => setShowTeamStats(!showTeamStats)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-semibold text-white">
                Estatísticas por Time
              </h3>
              <span className="text-sm text-gray-500">
                ({teamStats.length} times)
              </span>
            </div>
            {showTeamStats ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </CardHeader>
        {showTeamStats && (
          <CardContent>
            {teamStats.length > 0 ? (
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-gray-900">
                    <tr className="text-left text-gray-400 text-sm border-b border-gray-800">
                      <th className="pb-3 font-medium">Time</th>
                      <th className="pb-3 font-medium text-center">Apostas</th>
                      <th className="pb-3 font-medium text-center">V/D</th>
                      <th className="pb-3 font-medium text-center">Win Rate</th>
                      <th className="pb-3 font-medium text-right">Lucro</th>
                      <th className="pb-3 font-medium text-right">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamStats.map((stat) => (
                      <tr
                        key={stat.name}
                        className="border-b border-gray-800/50 hover:bg-gray-800/30"
                      >
                        <td className="py-3 text-white">{stat.name}</td>
                        <td className="py-3 text-center text-gray-300">
                          {stat.totalBets}
                        </td>
                        <td className="py-3 text-center">
                          <span className="text-emerald-400">{stat.wins}</span>
                          <span className="text-gray-500">/</span>
                          <span className="text-red-400">{stat.losses}</span>
                        </td>
                        <td className="py-3 text-center">
                          <span
                            className={
                              stat.winRate >= 50
                                ? 'text-emerald-400'
                                : 'text-red-400'
                            }
                          >
                            {formatPercentage(stat.winRate)}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={
                              stat.profit >= 0
                                ? 'text-emerald-400'
                                : 'text-red-400'
                            }
                          >
                            {stat.profit >= 0 ? '+' : ''}
                            {formatCurrency(stat.profit)}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={
                              stat.roi >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }
                          >
                            {formatPercentage(stat.roi)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Nenhuma aposta encontrada
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Estatísticas por Campeonato */}
      <Card>
        <CardHeader>
          <button
            onClick={() => setShowChampionshipStats(!showChampionshipStats)}
            className="flex items-center justify-between w-full"
          >
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <h3 className="text-lg font-semibold text-white">
                Estatísticas por Campeonato
              </h3>
            </div>
            {showChampionshipStats ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </CardHeader>
        {showChampionshipStats && (
          <CardContent>
            {championshipStats.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left text-gray-400 text-sm border-b border-gray-800">
                      <th className="pb-3 font-medium">Campeonato</th>
                      <th className="pb-3 font-medium text-center">Apostas</th>
                      <th className="pb-3 font-medium text-center">V/D</th>
                      <th className="pb-3 font-medium text-center">Win Rate</th>
                      <th className="pb-3 font-medium text-right">Apostado</th>
                      <th className="pb-3 font-medium text-right">Lucro</th>
                      <th className="pb-3 font-medium text-right">ROI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {championshipStats.map((stat) => (
                      <tr
                        key={stat.name}
                        className="border-b border-gray-800/50 hover:bg-gray-800/30"
                      >
                        <td className="py-3 text-white">{stat.name}</td>
                        <td className="py-3 text-center text-gray-300">
                          {stat.totalBets}
                        </td>
                        <td className="py-3 text-center">
                          <span className="text-emerald-400">{stat.wins}</span>
                          <span className="text-gray-500">/</span>
                          <span className="text-red-400">{stat.losses}</span>
                        </td>
                        <td className="py-3 text-center">
                          <span
                            className={
                              stat.winRate >= 50
                                ? 'text-emerald-400'
                                : 'text-red-400'
                            }
                          >
                            {formatPercentage(stat.winRate)}
                          </span>
                        </td>
                        <td className="py-3 text-right text-gray-300">
                          {formatCurrency(stat.totalBet)}
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={
                              stat.profit >= 0
                                ? 'text-emerald-400'
                                : 'text-red-400'
                            }
                          >
                            {stat.profit >= 0 ? '+' : ''}
                            {formatCurrency(stat.profit)}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <span
                            className={
                              stat.roi >= 0 ? 'text-emerald-400' : 'text-red-400'
                            }
                          >
                            {formatPercentage(stat.roi)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Nenhuma aposta encontrada
              </p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Times Mais Apostados (Gráfico) */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="text-lg font-semibold text-white">Top 10 Times Mais Apostados</h3>
          </div>
        </CardHeader>
        <CardContent>
          {mostBettedTeams.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mostBettedTeams} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9CA3AF" fontSize={12} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="#9CA3AF"
                    fontSize={11}
                    width={120}
                    tickFormatter={(value) =>
                      value.length > 15 ? value.substring(0, 15) + '...' : value
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px',
                    }}
                    formatter={(value) => [value, 'Apostas']}
                  />
                  <Bar dataKey="totalBets" fill="#10B981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              Nenhuma aposta encontrada
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

export default function AnalyticsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Análises</h1>
          <p className="text-gray-400">
            Estatísticas detalhadas e tendências das suas apostas
          </p>
        </div>

        <AnalyticsContent />
      </div>
    </MainLayout>
  );
}
