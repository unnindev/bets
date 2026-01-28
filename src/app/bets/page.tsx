'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
  Search,
  Filter,
  Edit2,
  Trash2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { Bet, Wallet, BetResult } from '@/types';

const ITEMS_PER_PAGE = 10;

export default function BetsPage() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBet, setEditingBet] = useState<Bet | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterWallet, setFilterWallet] = useState('all');
  const [filterResult, setFilterResult] = useState('all');
  const [filterChampionship, setFilterChampionship] = useState('all');

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);

    const [walletsResult, betsResult] = await Promise.all([
      supabase.from('wallets').select('*').order('name'),
      supabase.from('bets').select('*, wallet:wallets(name)').order('match_date', { ascending: false }),
    ]);

    if (walletsResult.data) setWallets(walletsResult.data);
    if (betsResult.data) setBets(betsResult.data);

    setIsLoading(false);
  };

  const handleCreateBet = async (data: Partial<Bet>) => {
    const { data: user } = await supabase.auth.getUser();

    const { error } = await supabase.from('bets').insert({
      ...data,
      user_id: user.user?.id,
    });

    if (!error) {
      setIsModalOpen(false);
      loadData();
    }
  };

  const handleUpdateBet = async (data: Partial<Bet>) => {
    if (!editingBet) return;

    const { error } = await supabase
      .from('bets')
      .update(data)
      .eq('id', editingBet.id);

    if (!error) {
      setEditingBet(null);
      setIsModalOpen(false);
      loadData();
    }
  };

  const handleDeleteBet = async (id: string) => {
    const { error } = await supabase.from('bets').delete().eq('id', id);

    if (!error) {
      setDeleteConfirm(null);
      loadData();
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

  // Filtrar apostas
  const filteredBets = bets.filter((bet) => {
    const matchesSearch =
      searchTerm === '' ||
      bet.team_a.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bet.team_b.toLowerCase().includes(searchTerm.toLowerCase()) ||
      bet.championship.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesWallet = filterWallet === 'all' || bet.wallet_id === filterWallet;
    const matchesResult = filterResult === 'all' || bet.result === filterResult;
    const matchesChampionship =
      filterChampionship === 'all' || bet.championship === filterChampionship;

    return matchesSearch && matchesWallet && matchesResult && matchesChampionship;
  });

  // Paginação
  const totalPages = Math.ceil(filteredBets.length / ITEMS_PER_PAGE);
  const paginatedBets = filteredBets.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Resetar página quando filtros mudam
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterWallet, filterResult, filterChampionship]);

  // Lista de campeonatos únicos
  const championships = [...new Set(bets.map((b) => b.championship))].sort();

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

  const championshipOptions = [
    { value: 'all', label: 'Todos os campeonatos' },
    ...championships.map((c) => ({ value: c, label: c })),
  ];

  const getBetTypeLabel = (type: string) => {
    return BET_TYPES.find((t) => t.value === type)?.label || type;
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Apostas</h1>
            <p className="text-gray-400">
              {filteredBets.length} aposta{filteredBets.length !== 1 ? 's' : ''} encontrada
              {filteredBets.length !== 1 ? 's' : ''}
            </p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="w-5 h-5" />
            Nova Aposta
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="relative lg:col-span-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  placeholder="Buscar times..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
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
              <Select
                options={championshipOptions}
                value={filterChampionship}
                onChange={(e) => setFilterChampionship(e.target.value)}
              />
              <Button
                variant="ghost"
                onClick={() => {
                  setSearchTerm('');
                  setFilterWallet('all');
                  setFilterResult('all');
                  setFilterChampionship('all');
                }}
              >
                Limpar filtros
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Apostas */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
          </div>
        ) : paginatedBets.length > 0 ? (
          <>
            <div className="space-y-3">
              {paginatedBets.map((bet) => (
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
                          <span>{formatDate(bet.match_date)}</span>
                          <span>•</span>
                          <span>{getBetTypeLabel(bet.bet_type)}</span>
                          {bet.score_team_a !== null && bet.score_team_b !== null && (
                            <>
                              <span>•</span>
                              <span className="text-white">
                                {bet.score_team_a} x {bet.score_team_b}
                              </span>
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

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-gray-400 text-sm px-4">
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <p className="text-gray-400">Nenhuma aposta encontrada.</p>
              {wallets.length === 0 ? (
                <p className="text-gray-500 text-sm mt-2">
                  Crie uma carteira primeiro na página de Carteiras.
                </p>
              ) : (
                <Button className="mt-4" onClick={() => setIsModalOpen(true)}>
                  <Plus className="w-5 h-5" />
                  Criar primeira aposta
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Modal de Nova/Editar Aposta */}
        <Modal
          isOpen={isModalOpen}
          onClose={closeModal}
          title={editingBet ? 'Editar Aposta' : 'Nova Aposta'}
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
