'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency, formatPercentage } from '@/lib/constants';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  PiggyBank,
  Activity,
  BarChart3,
  Percent,
  Landmark,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { useWallet } from '@/contexts/WalletContext';
import type { Bet, CombinedBet, DashboardStats } from '@/types';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
}

function StatCard({ title, value, subtitle, icon, trend }: StatCardProps) {
  const trendColors = {
    up: 'text-emerald-400',
    down: 'text-red-400',
    neutral: 'text-gray-400',
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-400 mb-1">{title}</p>
            <p className={`text-2xl font-bold ${trend ? trendColors[trend] : 'text-white'}`}>
              {value}
            </p>
            {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
          </div>
          <div className="p-3 bg-gray-800 rounded-lg">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardContent() {
  const { selectedWalletId, selectedWallet, isLoading: walletLoading, reloadWallets } = useWallet();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [combinedBets, setCombinedBets] = useState<CombinedBet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    if (selectedWalletId) {
      loadStats();
    }
  }, [selectedWalletId]);

  const loadStats = async () => {
    if (!selectedWalletId) return;

    setIsLoading(true);

    // Recarregar carteira para pegar saldo atualizado
    await reloadWallets();

    // Carregar apostas simples da carteira selecionada
    const { data: betsData } = await supabase
      .from('bets')
      .select('*')
      .eq('wallet_id', selectedWalletId)
      .order('match_date', { ascending: true });

    // Carregar apostas combinadas da carteira selecionada
    const { data: combinedData } = await supabase
      .from('combined_bets')
      .select('*')
      .eq('wallet_id', selectedWalletId)
      .order('match_date', { ascending: true });

    if (betsData) setBets(betsData);
    if (combinedData) setCombinedBets(combinedData);

    // Calcular estatísticas
    const allBetsData = betsData || [];
    const allCombinedData = combinedData || [];

    // Contar totais
    const totalBets = allBetsData.length + allCombinedData.length;

    // Wins e losses
    let wins = allBetsData.filter((b) => b.result === 'win').length;
    let losses = allBetsData.filter((b) => b.result === 'loss').length;
    let pending = allBetsData.filter((b) => b.result === 'pending').length;

    wins += allCombinedData.filter((b) => b.result === 'win').length;
    losses += allCombinedData.filter((b) => b.result === 'loss').length;
    pending += allCombinedData.filter((b) => b.result === 'pending').length;

    const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : 0;

    // Total apostado
    const totalAmountBetSimple = allBetsData.reduce((sum, b) => sum + Number(b.amount), 0);
    const totalAmountBetCombined = allCombinedData.reduce((sum, b) => sum + Number(b.amount), 0);
    const totalAmountBet = totalAmountBetSimple + totalAmountBetCombined;

    // Para cálculo de lucro, considerar apenas apostas finalizadas
    const finishedBetsSimple = allBetsData.filter((b) => b.result !== 'pending');
    const finishedBetsCombined = allCombinedData.filter((b) => b.result !== 'pending');

    const totalAmountBetFinished =
      finishedBetsSimple.reduce((sum, b) => sum + Number(b.amount), 0) +
      finishedBetsCombined.reduce((sum, b) => sum + Number(b.amount), 0);

    const totalReturn =
      finishedBetsSimple.reduce((sum, b) => sum + Number(b.return_amount), 0) +
      finishedBetsCombined.reduce((sum, b) => sum + Number(b.return_amount), 0);

    const totalProfit = totalReturn - totalAmountBetFinished;
    const roi = totalAmountBetFinished > 0 ? (totalProfit / totalAmountBetFinished) * 100 : 0;

    // ROI sobre capital inicial (quanto o dinheiro inicial cresceu)
    const initialBalance = selectedWallet ? Number(selectedWallet.initial_balance) : 0;
    const currentBalance = selectedWallet ? Number(selectedWallet.balance) : 0;
    const capitalProfit = currentBalance - initialBalance;
    const roiCapital = initialBalance > 0 ? (capitalProfit / initialBalance) * 100 : 0;

    setStats({
      total_bets: totalBets,
      total_wins: wins,
      total_losses: losses,
      total_pending: pending,
      win_rate: isNaN(winRate) ? 0 : winRate,
      total_deposited: initialBalance,
      total_withdrawn: 0,
      current_balance: currentBalance,
      total_profit: totalProfit,
      total_amount_bet: totalAmountBet,
      total_return: totalReturn,
      roi: isNaN(roi) ? 0 : roi,
      roi_capital: isNaN(roiCapital) ? 0 : roiCapital,
    });

    setIsLoading(false);
  };

  // Dados para o gráfico de evolução do saldo
  const getBalanceChartData = () => {
    if (!bets.length && !combinedBets.length) return [];

    const allBets = [
      ...bets.map((b) => ({ ...b, type: 'simple' as const })),
      ...combinedBets.map((b) => ({ ...b, type: 'combined' as const })),
    ].sort((a, b) => new Date(a.match_date).getTime() - new Date(b.match_date).getTime());

    let runningBalance = stats?.total_deposited || 0;
    const data: { date: string; balance: number }[] = [];

    allBets.forEach((bet) => {
      if (bet.result === 'pending') return;

      runningBalance -= Number(bet.amount);
      if (bet.result === 'win' || bet.result === 'cashout') {
        runningBalance += Number(bet.return_amount);
      }

      const dateStr = new Date(bet.match_date).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
      });

      const existingEntry = data.find((d) => d.date === dateStr);
      if (existingEntry) {
        existingEntry.balance = runningBalance;
      } else {
        data.push({ date: dateStr, balance: runningBalance });
      }
    });

    return data;
  };

  // Dados para o gráfico de resultados por mês
  const getMonthlyChartData = () => {
    const monthlyData: Record<string, { wins: number; losses: number }> = {};

    bets.forEach((bet) => {
      if (bet.result === 'pending') return;

      const month = new Date(bet.match_date).toLocaleDateString('pt-BR', {
        month: 'short',
        year: '2-digit',
      });

      if (!monthlyData[month]) {
        monthlyData[month] = { wins: 0, losses: 0 };
      }

      if (bet.result === 'win' || bet.result === 'cashout') {
        monthlyData[month].wins += 1;
      } else {
        monthlyData[month].losses += 1;
      }
    });

    combinedBets.forEach((bet) => {
      if (bet.result === 'pending') return;

      const month = new Date(bet.match_date).toLocaleDateString('pt-BR', {
        month: 'short',
        year: '2-digit',
      });

      if (!monthlyData[month]) {
        monthlyData[month] = { wins: 0, losses: 0 };
      }

      if (bet.result === 'win' || bet.result === 'cashout') {
        monthlyData[month].wins += 1;
      } else {
        monthlyData[month].losses += 1;
      }
    });

    return Object.entries(monthlyData).map(([month, data]) => ({
      month,
      ...data,
    }));
  };

  if (walletLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!selectedWallet) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <p className="text-gray-400">Nenhuma carteira encontrada.</p>
          <p className="text-gray-500 text-sm mt-2">
            Crie uma carteira na página de Carteiras para começar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : stats ? (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              title="Saldo Atual"
              value={formatCurrency(stats.current_balance)}
              subtitle={`Depositado: ${formatCurrency(stats.total_deposited)}`}
              icon={<DollarSign className="w-5 h-5 text-emerald-400" />}
              trend={stats.current_balance >= stats.total_deposited ? 'up' : 'down'}
            />
            <StatCard
              title="Lucro/Prejuízo"
              value={formatCurrency(stats.current_balance - stats.total_deposited)}
              subtitle={`Saldo - Depositado`}
              icon={
                stats.current_balance >= stats.total_deposited ? (
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-400" />
                )
              }
              trend={stats.current_balance >= stats.total_deposited ? 'up' : 'down'}
            />
            <StatCard
              title="Win Rate"
              value={formatPercentage(stats.win_rate)}
              subtitle={`${stats.total_wins}V / ${stats.total_losses}D`}
              icon={<Target className="w-5 h-5 text-blue-400" />}
              trend={stats.win_rate >= 50 ? 'up' : 'down'}
            />
          </div>

          {/* ROI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-400 mb-1">ROI sobre Capital</p>
                    <p className={`text-2xl font-bold ${stats.roi_capital >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatPercentage(stats.roi_capital)}
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
                    <p className={`text-2xl font-bold ${stats.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatPercentage(stats.roi)}
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

          {/* Total Apostado */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Apostado"
              value={formatCurrency(stats.total_amount_bet)}
              subtitle={`${stats.total_bets} apostas (${stats.total_pending} pendentes)`}
              icon={<PiggyBank className="w-5 h-5 text-purple-400" />}
            />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Balance Evolution Chart */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-lg font-semibold text-white">Evolução do Saldo</h3>
                </div>
              </CardHeader>
              <CardContent>
                {getBalanceChartData().length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={getBalanceChartData()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="date" stroke="#9CA3AF" fontSize={12} />
                        <YAxis stroke="#9CA3AF" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1F2937',
                            border: '1px solid #374151',
                            borderRadius: '8px',
                          }}
                          formatter={(value) => [formatCurrency(Number(value)), 'Saldo']}
                        />
                        <Line
                          type="monotone"
                          dataKey="balance"
                          stroke="#10B981"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    Nenhuma aposta finalizada ainda
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Monthly Results Chart */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">Resultados por Mês</h3>
                </div>
              </CardHeader>
              <CardContent>
                {getMonthlyChartData().length > 0 ? (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getMonthlyChartData()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="month" stroke="#9CA3AF" fontSize={12} />
                        <YAxis stroke="#9CA3AF" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: '#1F2937',
                            border: '1px solid #374151',
                            borderRadius: '8px',
                          }}
                        />
                        <Bar dataKey="wins" name="Vitórias" fill="#10B981" />
                        <Bar dataKey="losses" name="Derrotas" fill="#EF4444" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    Nenhuma aposta finalizada ainda
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5 text-center">
                <p className="text-gray-400 text-sm mb-1">Total Retornado</p>
                <p className="text-xl font-bold text-white">
                  {formatCurrency(stats.total_return)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-center">
                <p className="text-gray-400 text-sm mb-1">Média por Aposta</p>
                <p className="text-xl font-bold text-white">
                  {formatCurrency(
                    stats.total_bets > 0 ? stats.total_amount_bet / stats.total_bets : 0
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 text-center">
                <p className="text-gray-400 text-sm mb-1">Odd Média</p>
                <p className="text-xl font-bold text-white">
                  {(bets.length + combinedBets.length) > 0
                    ? (
                        (bets.reduce((sum, b) => sum + Number(b.odds), 0) +
                          combinedBets.reduce((sum, b) => sum + Number(b.odds), 0)) /
                        (bets.length + combinedBets.length)
                      ).toFixed(2)
                    : '0.00'}
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </>
  );
}

export default function DashboardPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-gray-400">Visão geral das suas apostas</p>
        </div>

        <DashboardContent />
      </div>
    </MainLayout>
  );
}
