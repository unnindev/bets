'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { BetForm } from '@/components/bets/BetForm';
import { BetFormUnified } from '@/components/bets/BetFormUnified';
import { createClient } from '@/lib/supabase/client';
import {
  formatCurrency,
  formatDate,
  RESULT_COLORS,
  RESULT_LABELS,
  BET_TYPES,
  BET_RESULTS,
} from '@/lib/constants';
import { Input } from '@/components/ui/Input';
import {
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { useWallet } from '@/contexts/WalletContext';
import type { Bet, Wallet, BetResult, CombinedBet, CombinedBetItem } from '@/types';

// Formata data local para YYYY-MM-DD sem problemas de fuso horário
const formatLocalDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Parseia YYYY-MM-DD para Date local (meio-dia para evitar problemas de fuso)
const parseLocalDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
};

// Formulário de edição de aposta combinada
interface CombinedBetEditFormProps {
  bet: CombinedBet;
  onSubmit: (data: {
    result: BetResult;
    return_amount: number;
    is_risky: boolean;
    notes?: string;
  }) => Promise<void>;
  onCancel: () => void;
}

function CombinedBetEditForm({ bet, onSubmit, onCancel }: CombinedBetEditFormProps) {
  const [result, setResult] = useState<BetResult>(bet.result);
  const [returnAmount, setReturnAmount] = useState(String(bet.return_amount));
  const [isRisky, setIsRisky] = useState(bet.is_risky);
  const [notes, setNotes] = useState(bet.notes || '');
  const [isLoading, setIsLoading] = useState(false);

  // Calcular retorno automaticamente quando resultado mudar para win
  useEffect(() => {
    if (result === 'win') {
      const calculated = Number(bet.amount) * Number(bet.odds);
      setReturnAmount(calculated.toFixed(2));
    } else if (result === 'loss') {
      setReturnAmount('0');
    }
  }, [result, bet.amount, bet.odds]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSubmit({
        result,
        return_amount: Number(returnAmount),
        is_risky: isRisky,
        notes: notes || undefined,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getBetTypeLabel = (type: string) => {
    return BET_TYPES.find((t) => t.value === type)?.label || type;
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      {/* Resumo da aposta */}
      <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
        <div className="flex items-center gap-2 text-purple-400 font-medium">
          <Layers className="w-4 h-4" />
          <span>Combinada ({bet.items?.length || 0} jogos)</span>
        </div>
        {bet.items?.map((item, index) => (
          <div key={index} className="text-sm text-gray-400 pl-6">
            {item.team_a} x {item.team_b} • {item.championship} • {getBetTypeLabel(item.bet_type)}
          </div>
        ))}
        <div className="flex gap-4 mt-3 pt-3 border-t border-gray-700 text-sm">
          <div>
            <span className="text-gray-500">Apostado: </span>
            <span className="text-white font-medium">{formatCurrency(bet.amount)}</span>
          </div>
          <div>
            <span className="text-gray-500">Odds: </span>
            <span className="text-white font-medium">{bet.odds.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Resultado */}
      <Select
        label="Resultado"
        value={result}
        onChange={(e) => setResult(e.target.value as BetResult)}
        options={BET_RESULTS}
      />

      {/* Retorno */}
      {result !== 'pending' && (
        <Input
          label="Retorno (R$)"
          type="number"
          step="0.01"
          min="0"
          value={returnAmount}
          onChange={(e) => setReturnAmount(e.target.value)}
          placeholder="0.00"
        />
      )}

      {/* Arriscada */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isRisky}
          onChange={(e) => setIsRisky(e.target.checked)}
          className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-gray-900"
        />
        <span className="text-gray-300">Aposta arriscada</span>
      </label>

      {/* Notas */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Observações</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-none"
          placeholder="Anotações sobre a aposta..."
        />
      </div>

      {/* Botões */}
      <div className="flex gap-3 justify-end pt-4 border-t border-gray-800">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isLoading}>
          Salvar
        </Button>
      </div>
    </form>
  );
}

function BetsContent() {
  const { selectedWalletId, selectedWallet, wallets, isLoading: walletLoading, reloadWallets } = useWallet();
  const [bets, setBets] = useState<Bet[]>([]);
  const [combinedBets, setCombinedBets] = useState<CombinedBet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBet, setEditingBet] = useState<Bet | null>(null);
  const [editingCombinedBet, setEditingCombinedBet] = useState<CombinedBet | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteCombinedConfirm, setDeleteCombinedConfirm] = useState<string | null>(null);
  const [isCheckingResults, setIsCheckingResults] = useState(false);
  const [checkResultsMessage, setCheckResultsMessage] = useState<string | null>(null);

  // Data selecionada (padrão: hoje)
  const [selectedDate, setSelectedDate] = useState(() => {
    return formatLocalDate(new Date());
  });

  // Filtro de resultado
  const [filterResult, setFilterResult] = useState('all');

  const supabase = createClient();

  useEffect(() => {
    if (selectedWalletId) {
      loadBetsForDate();
    }
  }, [selectedDate, selectedWalletId]);

  const loadBetsForDate = async () => {
    if (!selectedWalletId) return;

    setIsLoading(true);

    // Carregar apostas simples da carteira selecionada
    const { data: simpleBets } = await supabase
      .from('bets')
      .select('*, wallet:wallets(name)')
      .eq('match_date', selectedDate)
      .eq('wallet_id', selectedWalletId)
      .order('created_at', { ascending: false });

    if (simpleBets) setBets(simpleBets);

    // Carregar apostas combinadas da carteira selecionada
    const { data: combined } = await supabase
      .from('combined_bets')
      .select('*, items:combined_bet_items(*), wallet:wallets(name)')
      .eq('match_date', selectedDate)
      .eq('wallet_id', selectedWalletId)
      .order('created_at', { ascending: false });

    if (combined) setCombinedBets(combined);

    setIsLoading(false);
  };

  const handleCreateBet = async (data: Partial<Bet>) => {
    const { data: user } = await supabase.auth.getUser();

    const { error } = await supabase.from('bets').insert({
      ...data,
      wallet_id: selectedWalletId, // Usar carteira selecionada
      match_date: selectedDate,
      user_id: user.user?.id,
    });

    if (!error) {
      setIsModalOpen(false);
      loadBetsForDate();
      reloadWallets(); // Atualizar saldo
    }
  };

  const handleUpdateBet = async (data: Partial<Bet>) => {
    if (!editingBet) return;

    const { error } = await supabase
      .from('bets')
      .update({
        ...data,
        match_date: selectedDate,
      })
      .eq('id', editingBet.id);

    if (!error) {
      setEditingBet(null);
      setIsModalOpen(false);
      loadBetsForDate();
      reloadWallets(); // Atualizar saldo
    }
  };

  const handleDeleteBet = async (id: string) => {
    const { error } = await supabase.from('bets').delete().eq('id', id);

    if (!error) {
      setDeleteConfirm(null);
      loadBetsForDate();
      reloadWallets(); // Atualizar saldo
    }
  };

  const handleCreateCombinedBet = async (data: {
    wallet_id: string;
    amount: number;
    odds: number;
    result: BetResult;
    return_amount: number;
    is_risky: boolean;
    notes?: string;
    items: CombinedBetItem[];
  }) => {
    const { data: user } = await supabase.auth.getUser();

    // Primeiro criar a aposta combinada
    const { data: combinedBet, error: combinedError } = await supabase
      .from('combined_bets')
      .insert({
        wallet_id: selectedWalletId, // Usar carteira selecionada
        user_id: user.user?.id,
        amount: data.amount,
        odds: data.odds,
        result: data.result,
        return_amount: data.return_amount,
        is_risky: data.is_risky,
        notes: data.notes,
        match_date: selectedDate,
      })
      .select()
      .single();

    if (combinedError || !combinedBet) {
      console.error('Erro ao criar aposta combinada:', combinedError);
      return;
    }

    // Depois adicionar os itens
    const itemsToInsert = data.items.map((item) => ({
      combined_bet_id: combinedBet.id,
      team_a: item.team_a,
      team_b: item.team_b,
      championship: item.championship,
      bet_type: item.bet_type,
      bet_type_description: item.bet_type_description,
    }));

    const { error: itemsError } = await supabase
      .from('combined_bet_items')
      .insert(itemsToInsert);

    if (!itemsError) {
      setIsModalOpen(false);
      loadBetsForDate();
      reloadWallets(); // Atualizar saldo
    } else {
      console.error('Erro ao criar itens da combinada:', itemsError);
    }
  };

  const handleDeleteCombinedBet = async (id: string) => {
    const { error } = await supabase.from('combined_bets').delete().eq('id', id);

    if (!error) {
      setDeleteCombinedConfirm(null);
      loadBetsForDate();
      reloadWallets(); // Atualizar saldo
    }
  };

  const handleUpdateCombinedBet = async (data: {
    result: BetResult;
    return_amount: number;
    is_risky: boolean;
    notes?: string;
  }) => {
    if (!editingCombinedBet) return;

    const { error } = await supabase
      .from('combined_bets')
      .update({
        result: data.result,
        return_amount: data.return_amount,
        is_risky: data.is_risky,
        notes: data.notes,
      })
      .eq('id', editingCombinedBet.id);

    if (!error) {
      setEditingCombinedBet(null);
      loadBetsForDate();
      reloadWallets(); // Atualizar saldo
    }
  };

  const openEditModal = (bet: Bet) => {
    setEditingBet(bet);
    setIsModalOpen(true);
  };

  const openEditCombinedModal = (bet: CombinedBet) => {
    setEditingCombinedBet(bet);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingBet(null);
  };

  const closeCombinedEditModal = () => {
    setEditingCombinedBet(null);
  };

  // Verificar resultados automaticamente
  const handleCheckResults = async () => {
    setIsCheckingResults(true);
    setCheckResultsMessage(null);

    try {
      const response = await fetch('/api/bets/check-results', {
        method: 'POST',
      });
      const data = await response.json();

      if (data.success) {
        setCheckResultsMessage(data.message);
        if (data.updated > 0) {
          loadBetsForDate();
          reloadWallets();
        }
      } else {
        setCheckResultsMessage(`Erro: ${data.error}`);
      }
    } catch (error) {
      setCheckResultsMessage('Erro ao verificar resultados');
    } finally {
      setIsCheckingResults(false);
      // Limpar mensagem após 5 segundos
      setTimeout(() => setCheckResultsMessage(null), 5000);
    }
  };

  // Navegação de data
  const goToPreviousDay = () => {
    const date = parseLocalDate(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(formatLocalDate(date));
  };

  const goToNextDay = () => {
    const date = parseLocalDate(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(formatLocalDate(date));
  };

  const goToToday = () => {
    setSelectedDate(formatLocalDate(new Date()));
  };

  // Filtrar apostas por resultado
  const filteredBets = bets.filter((bet) => {
    return filterResult === 'all' || bet.result === filterResult;
  });

  const filteredCombinedBets = combinedBets.filter((bet) => {
    return filterResult === 'all' || bet.result === filterResult;
  });

  const resultOptions = [
    { value: 'all', label: 'Todos os resultados' },
    { value: 'pending', label: 'Pendente' },
    { value: 'win', label: 'Ganhou' },
    { value: 'loss', label: 'Perdeu' },
    { value: 'cashout', label: 'Cashout' },
  ];

  const getBetTypeLabel = (type: string) => {
    return BET_TYPES.find((t) => t.value === type)?.label || type;
  };

  // Calcular totais do dia
  const totals = filteredBets.reduce(
    (acc, bet) => {
      acc.totalBets++;
      acc.totalAmount += Number(bet.amount);
      if (bet.result === 'win' || bet.result === 'cashout') {
        acc.totalReturn += Number(bet.return_amount);
        acc.wins++;
      } else if (bet.result === 'loss') {
        acc.losses++;
      } else {
        acc.pending++;
      }
      return acc;
    },
    { totalBets: 0, totalAmount: 0, totalReturn: 0, wins: 0, losses: 0, pending: 0 }
  );

  // Adicionar combinadas aos totais
  filteredCombinedBets.forEach((bet) => {
    totals.totalBets++;
    totals.totalAmount += Number(bet.amount);
    if (bet.result === 'win' || bet.result === 'cashout') {
      totals.totalReturn += Number(bet.return_amount);
      totals.wins++;
    } else if (bet.result === 'loss') {
      totals.losses++;
    } else {
      totals.pending++;
    }
  });

  const profit = totals.totalReturn - totals.totalAmount;

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

  // Criar array com apenas a carteira selecionada para o formulário
  const selectedWalletArray: Wallet[] = selectedWallet ? [selectedWallet] : [];

  return (
    <>
      {/* Seletor de Data */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={goToPreviousDay}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-emerald-500" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                onClick={goToNextDay}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <Button variant="ghost" size="sm" onClick={goToToday}>
                Hoje
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <Select
                options={resultOptions}
                value={filterResult}
                onChange={(e) => setFilterResult(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo do Dia */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-gray-500 text-xs uppercase">Apostas</p>
            <p className="text-xl font-bold text-white">{totals.totalBets}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-gray-500 text-xs uppercase">Investido</p>
            <p className="text-xl font-bold text-white">{formatCurrency(totals.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-gray-500 text-xs uppercase">Retorno</p>
            <p className="text-xl font-bold text-white">{formatCurrency(totals.totalReturn)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-gray-500 text-xs uppercase">Lucro</p>
            <p className={`text-xl font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(profit)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-gray-500 text-xs uppercase">Ganhos</p>
            <p className="text-xl font-bold text-emerald-400">{totals.wins}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-gray-500 text-xs uppercase">Perdas</p>
            <p className="text-xl font-bold text-red-400">{totals.losses}</p>
          </CardContent>
        </Card>
      </div>

      {/* Header com botão de adicionar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">
            Apostas de {formatDate(selectedDate)}
          </h1>
          <p className="text-gray-400 text-sm">
            {filteredBets.length + filteredCombinedBets.length} aposta{(filteredBets.length + filteredCombinedBets.length) !== 1 ? 's' : ''}
            {totals.pending > 0 && ` (${totals.pending} pendente${totals.pending !== 1 ? 's' : ''})`}
          </p>
          {checkResultsMessage && (
            <p className={`text-sm mt-1 ${checkResultsMessage.startsWith('Erro') ? 'text-red-400' : 'text-emerald-400'}`}>
              {checkResultsMessage}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {totals.pending > 0 && (
            <Button
              variant="secondary"
              onClick={handleCheckResults}
              disabled={isCheckingResults}
            >
              <RefreshCw className={`w-4 h-4 ${isCheckingResults ? 'animate-spin' : ''}`} />
              {isCheckingResults ? 'Verificando...' : 'Atualizar Resultados'}
            </Button>
          )}
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="w-5 h-5" />
            Nova Aposta
          </Button>
        </div>
      </div>

      {/* Lista de Apostas */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
      ) : filteredBets.length > 0 || filteredCombinedBets.length > 0 ? (
        <div className="space-y-3">
          {/* Apostas Simples */}
          {filteredBets.map((bet) => (
            <Card key={bet.id} className="hover:border-gray-700 transition">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Info principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white truncate">
                        {bet.team_a} x {bet.team_b}
                      </span>
                      {bet.is_risky && (
                        <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-400">
                      <span>{bet.championship}</span>
                      <span>•</span>
                      <span>{getBetTypeLabel(bet.bet_type)}</span>
                      {bet.bet_type === 'other' && bet.bet_type_description && (
                        <>
                          <span>•</span>
                          <span className="text-gray-300">{bet.bet_type_description}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Valores */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="text-gray-500">Apostado</p>
                      <p className="font-medium text-white">{formatCurrency(bet.amount)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500">Odds</p>
                      <p className="font-medium text-white">{bet.odds.toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500">Retorno</p>
                      <p className="font-medium text-white">
                        {formatCurrency(bet.return_amount)}
                      </p>
                    </div>
                    {bet.result !== 'pending' && (
                      <div className="text-center">
                        <p className="text-gray-500">Lucro</p>
                        <p className={`font-medium ${
                          Number(bet.return_amount) - Number(bet.amount) >= 0
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }`}>
                          {Number(bet.return_amount) - Number(bet.amount) >= 0 ? '+' : ''}
                          {formatCurrency(Number(bet.return_amount) - Number(bet.amount))}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Status e ações */}
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${
                        RESULT_COLORS[bet.result as BetResult]
                      }`}
                    >
                      {RESULT_LABELS[bet.result as BetResult]}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(bet)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(bet.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Apostas Combinadas */}
          {filteredCombinedBets.map((bet) => (
            <Card key={bet.id} className="hover:border-gray-700 transition border-l-4 border-l-purple-500">
              <CardContent className="p-4">
                <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                  {/* Info principal */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Layers className="w-4 h-4 text-purple-400 flex-shrink-0" />
                      <span className="font-semibold text-white">
                        Combinada ({bet.items?.length || 0} jogos)
                      </span>
                      {bet.is_risky && (
                        <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                      )}
                    </div>
                    {/* Lista de jogos da combinada */}
                    <div className="space-y-1">
                      {bet.items?.map((item, index) => (
                        <div
                          key={item.id || index}
                          className="flex flex-wrap items-center gap-x-2 text-sm text-gray-400"
                        >
                          <span className="text-gray-300">
                            {item.team_a} x {item.team_b}
                          </span>
                          <span>•</span>
                          <span>{item.championship}</span>
                          <span>•</span>
                          <span className="text-purple-400">{getBetTypeLabel(item.bet_type)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Valores */}
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="text-gray-500">Apostado</p>
                      <p className="font-medium text-white">{formatCurrency(bet.amount)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500">Odds</p>
                      <p className="font-medium text-white">{bet.odds.toFixed(2)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500">Retorno</p>
                      <p className="font-medium text-white">
                        {formatCurrency(bet.return_amount)}
                      </p>
                    </div>
                    {bet.result !== 'pending' && (
                      <div className="text-center">
                        <p className="text-gray-500">Lucro</p>
                        <p className={`font-medium ${
                          Number(bet.return_amount) - Number(bet.amount) >= 0
                            ? 'text-emerald-400'
                            : 'text-red-400'
                        }`}>
                          {Number(bet.return_amount) - Number(bet.amount) >= 0 ? '+' : ''}
                          {formatCurrency(Number(bet.return_amount) - Number(bet.amount))}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Status e ações */}
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${
                        RESULT_COLORS[bet.result as BetResult]
                      }`}
                    >
                      {RESULT_LABELS[bet.result as BetResult]}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditCombinedModal(bet)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteCombinedConfirm(bet.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Nenhuma aposta para {formatDate(selectedDate)}.</p>
            <Button className="mt-4" onClick={() => setIsModalOpen(true)}>
              <Plus className="w-5 h-5" />
              Criar aposta para este dia
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Modal de Nova Aposta */}
      <Modal
        isOpen={isModalOpen && !editingBet}
        onClose={closeModal}
        title={`Nova Aposta - ${formatDate(selectedDate)}`}
        size="lg"
      >
        <BetFormUnified
          wallets={selectedWalletArray}
          onSubmitSimple={handleCreateBet}
          onSubmitCombined={handleCreateCombinedBet}
          onCancel={closeModal}
        />
      </Modal>

      {/* Modal de Editar Aposta Simples */}
      <Modal
        isOpen={isModalOpen && !!editingBet}
        onClose={closeModal}
        title="Editar Aposta"
        size="lg"
      >
        {editingBet && (
          <BetForm
            wallets={selectedWalletArray}
            bet={editingBet}
            onSubmit={handleUpdateBet}
            onCancel={closeModal}
          />
        )}
      </Modal>

      {/* Modal de Editar Aposta Combinada */}
      <Modal
        isOpen={!!editingCombinedBet}
        onClose={closeCombinedEditModal}
        title="Editar Aposta Combinada"
        size="md"
      >
        {editingCombinedBet && (
          <CombinedBetEditForm
            bet={editingCombinedBet}
            onSubmit={handleUpdateCombinedBet}
            onCancel={closeCombinedEditModal}
          />
        )}
      </Modal>

      {/* Modal de Confirmação de Exclusão (Aposta Simples) */}
      <Modal
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        title="Confirmar Exclusão"
        size="sm"
      >
        <div className="p-6">
          <p className="text-gray-300 mb-6">
            Tem certeza que deseja excluir esta aposta? Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteConfirm && handleDeleteBet(deleteConfirm)}
            >
              Excluir
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de Confirmação de Exclusão (Aposta Combinada) */}
      <Modal
        isOpen={!!deleteCombinedConfirm}
        onClose={() => setDeleteCombinedConfirm(null)}
        title="Confirmar Exclusão"
        size="sm"
      >
        <div className="p-6">
          <p className="text-gray-300 mb-6">
            Tem certeza que deseja excluir esta aposta combinada? Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setDeleteCombinedConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteCombinedConfirm && handleDeleteCombinedBet(deleteCombinedConfirm)}
            >
              Excluir
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function BetsPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <BetsContent />
      </div>
    </MainLayout>
  );
}
