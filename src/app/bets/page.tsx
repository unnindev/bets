'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { BetForm } from '@/components/bets/BetForm';
import { createClient } from '@/lib/supabase/client';
import {
  formatCurrency,
  formatDate,
  RESULT_COLORS,
  RESULT_LABELS,
  BET_TYPES,
} from '@/lib/constants';
import {
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import type { Bet, Wallet, BetResult } from '@/types';

export default function BetsPage() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBet, setEditingBet] = useState<Bet | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Data selecionada (padrão: hoje)
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Filtros
  const [filterWallet, setFilterWallet] = useState('all');
  const [filterResult, setFilterResult] = useState('all');

  const supabase = createClient();

  useEffect(() => {
    loadWallets();
  }, []);

  useEffect(() => {
    loadBetsForDate();
  }, [selectedDate]);

  const loadWallets = async () => {
    const { data } = await supabase.from('wallets').select('*').order('name');
    if (data) setWallets(data);
  };

  const loadBetsForDate = async () => {
    setIsLoading(true);

    const { data } = await supabase
      .from('bets')
      .select('*, wallet:wallets(name)')
      .eq('match_date', selectedDate)
      .order('created_at', { ascending: false });

    if (data) setBets(data);
    setIsLoading(false);
  };

  const handleCreateBet = async (data: Partial<Bet>) => {
    const { data: user } = await supabase.auth.getUser();

    const { error } = await supabase.from('bets').insert({
      ...data,
      match_date: selectedDate,
      user_id: user.user?.id,
    });

    if (!error) {
      setIsModalOpen(false);
      loadBetsForDate();
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
    }
  };

  const handleDeleteBet = async (id: string) => {
    const { error } = await supabase.from('bets').delete().eq('id', id);

    if (!error) {
      setDeleteConfirm(null);
      loadBetsForDate();
    }
  };

  const openEditModal = (bet: Bet) => {
    setEditingBet(bet);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingBet(null);
  };

  // Navegação de data
  const goToPreviousDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToNextDay = () => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + 1);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const goToToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Filtrar apostas
  const filteredBets = bets.filter((bet) => {
    const matchesWallet = filterWallet === 'all' || bet.wallet_id === filterWallet;
    const matchesResult = filterResult === 'all' || bet.result === filterResult;
    return matchesWallet && matchesResult;
  });

  const walletOptions = [
    { value: 'all', label: 'Todas as carteiras' },
    ...wallets.map((w) => ({ value: w.id, label: w.name })),
  ];

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

  const profit = totals.totalReturn - totals.totalAmount;

  return (
    <MainLayout>
      <div className="space-y-6">
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
                  options={walletOptions}
                  value={filterWallet}
                  onChange={(e) => setFilterWallet(e.target.value)}
                />
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
              {filteredBets.length} aposta{filteredBets.length !== 1 ? 's' : ''}
              {totals.pending > 0 && ` (${totals.pending} pendente${totals.pending !== 1 ? 's' : ''})`}
            </p>
          </div>
          <Button onClick={() => setIsModalOpen(true)} disabled={wallets.length === 0}>
            <Plus className="w-5 h-5" />
            Nova Aposta
          </Button>
        </div>

        {/* Lista de Apostas */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
          </div>
        ) : filteredBets.length > 0 ? (
          <div className="space-y-3">
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
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Nenhuma aposta para {formatDate(selectedDate)}.</p>
              {wallets.length === 0 ? (
                <p className="text-gray-500 text-sm mt-2">
                  Crie uma carteira primeiro na página de Carteiras.
                </p>
              ) : (
                <Button className="mt-4" onClick={() => setIsModalOpen(true)}>
                  <Plus className="w-5 h-5" />
                  Criar aposta para este dia
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Modal de Nova/Editar Aposta */}
        <Modal
          isOpen={isModalOpen}
          onClose={closeModal}
          title={editingBet ? 'Editar Aposta' : `Nova Aposta - ${formatDate(selectedDate)}`}
          size="lg"
        >
          {wallets.length > 0 ? (
            <BetForm
              wallets={wallets}
              bet={editingBet}
              onSubmit={editingBet ? handleUpdateBet : handleCreateBet}
              onCancel={closeModal}
            />
          ) : (
            <div className="p-6 text-center">
              <p className="text-gray-400">Você precisa criar uma carteira primeiro.</p>
            </div>
          )}
        </Modal>

        {/* Modal de Confirmação de Exclusão */}
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
      </div>
    </MainLayout>
  );
}
