'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/constants';
import {
  Plus,
  Wallet,
  Users,
  Edit2,
  Trash2,
  UserPlus,
  UserMinus,
  DollarSign,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import type { Wallet as WalletType, WalletManager, User, Transaction } from '@/types';

interface WalletWithManagers extends WalletType {
  managers: (WalletManager & { user: User })[];
}

export default function WalletsPage() {
  const [wallets, setWallets] = useState<WalletWithManagers[]>([]);
  const [profiles, setProfiles] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Modais
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<WalletWithManagers | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [managingWallet, setManagingWallet] = useState<WalletWithManagers | null>(null);
  const [transactionWallet, setTransactionWallet] = useState<WalletWithManagers | null>(null);

  // Form states
  const [walletName, setWalletName] = useState('');
  const [initialBalance, setInitialBalance] = useState('');
  const [addManagerEmail, setAddManagerEmail] = useState('');
  const [transactionType, setTransactionType] = useState<'deposit' | 'withdraw'>('deposit');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionDescription, setTransactionDescription] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);

    const { data: userData } = await supabase.auth.getUser();
    if (userData.user) {
      setCurrentUserId(userData.user.id);
    }

    const { data: walletsData, error: walletsError } = await supabase
      .from('wallets')
      .select(`
        *,
        managers:wallet_managers(
          *,
          user:profiles(*)
        )
      `)
      .order('name');

    if (walletsError) {
      console.error('Erro ao carregar carteiras:', walletsError);
    }
    console.log('Carteiras carregadas:', walletsData);

    const { data: profilesData } = await supabase.from('profiles').select('*');

    if (walletsData) setWallets(walletsData);
    if (profilesData) setProfiles(profilesData);

    setIsLoading(false);
  };

  const handleCreateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Criar carteira
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .insert({
        name: walletName,
        balance: Number(initialBalance) || 0,
        initial_balance: Number(initialBalance) || 0,
      })
      .select()
      .single();

    if (walletError || !wallet) {
      console.error('Erro ao criar carteira:', walletError);
      alert('Erro ao criar carteira: ' + walletError?.message);
      setIsSubmitting(false);
      return;
    }

    // Adicionar usuário atual como owner
    const { error: managerError } = await supabase.from('wallet_managers').insert({
      wallet_id: wallet.id,
      user_id: currentUserId,
      role: 'owner',
    });

    if (managerError) {
      console.error('Erro ao adicionar gestor:', managerError);
      alert('Erro ao adicionar gestor: ' + managerError?.message);
    }

    setWalletName('');
    setInitialBalance('');
    setIsCreateModalOpen(false);
    setIsSubmitting(false);
    loadData();
  };

  const handleUpdateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWallet) return;
    setIsSubmitting(true);

    await supabase
      .from('wallets')
      .update({ name: walletName })
      .eq('id', editingWallet.id);

    setWalletName('');
    setEditingWallet(null);
    setIsSubmitting(false);
    loadData();
  };

  const handleDeleteWallet = async (id: string) => {
    await supabase.from('wallets').delete().eq('id', id);
    setDeleteConfirm(null);
    loadData();
  };

  const handleAddManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managingWallet) return;
    setIsSubmitting(true);

    // Buscar usuário pelo email
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', addManagerEmail)
      .single();

    if (profile) {
      await supabase.from('wallet_managers').insert({
        wallet_id: managingWallet.id,
        user_id: profile.id,
        role: 'manager',
      });
    }

    setAddManagerEmail('');
    setIsSubmitting(false);
    loadData();
  };

  const handleRemoveManager = async (managerId: string) => {
    await supabase.from('wallet_managers').delete().eq('id', managerId);
    loadData();
  };

  const handleTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transactionWallet) return;
    setIsSubmitting(true);

    await supabase.from('transactions').insert({
      wallet_id: transactionWallet.id,
      user_id: currentUserId,
      type: transactionType,
      amount: Number(transactionAmount),
      description: transactionDescription || null,
    });

    setTransactionAmount('');
    setTransactionDescription('');
    setTransactionWallet(null);
    setIsSubmitting(false);
    loadData();
  };

  const openEditModal = (wallet: WalletWithManagers) => {
    setEditingWallet(wallet);
    setWalletName(wallet.name);
  };

  const isOwner = (wallet: WalletWithManagers) => {
    return wallet.managers.some(
      (m) => m.user_id === currentUserId && m.role === 'owner'
    );
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Carteiras</h1>
            <p className="text-gray-400">Gerencie suas carteiras e gestores</p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-5 h-5" />
            Nova Carteira
          </Button>
        </div>

        {/* Lista de Carteiras */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
          </div>
        ) : wallets.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {wallets.map((wallet) => (
              <Card key={wallet.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-500/10 rounded-lg">
                      <Wallet className="w-5 h-5 text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{wallet.name}</h3>
                      <p className="text-sm text-gray-400">
                        {wallet.managers.length} gestor
                        {wallet.managers.length !== 1 ? 'es' : ''}
                      </p>
                    </div>
                  </div>
                  {isOwner(wallet) && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(wallet)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirm(wallet.id)}
                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Saldo */}
                  <div className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                    <div>
                      <p className="text-sm text-gray-400">Saldo Atual</p>
                      <p className="text-2xl font-bold text-white">
                        {formatCurrency(wallet.balance)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Depositado</p>
                      <p className="text-lg font-medium text-gray-300">
                        {formatCurrency(wallet.initial_balance)}
                      </p>
                    </div>
                  </div>

                  {/* Gestores */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium text-gray-400">Gestores</p>
                      {isOwner(wallet) && (
                        <button
                          onClick={() => setManagingWallet(wallet)}
                          className="text-emerald-400 hover:text-emerald-300 text-sm flex items-center gap-1"
                        >
                          <UserPlus className="w-4 h-4" />
                          Adicionar
                        </button>
                      )}
                    </div>
                    <div className="space-y-2">
                      {wallet.managers.map((manager) => (
                        <div
                          key={manager.id}
                          className="flex items-center justify-between p-2 bg-gray-800/30 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center text-sm font-medium text-white">
                              {manager.user?.name?.[0]?.toUpperCase() ||
                                manager.user?.email?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm text-white">
                                {manager.user?.name || manager.user?.email}
                              </p>
                              <p className="text-xs text-gray-500">
                                {manager.role === 'owner' ? 'Proprietário' : 'Gestor'}
                              </p>
                            </div>
                          </div>
                          {isOwner(wallet) &&
                            manager.role !== 'owner' &&
                            manager.user_id !== currentUserId && (
                              <button
                                onClick={() => handleRemoveManager(manager.id)}
                                className="p-1 text-gray-500 hover:text-red-400 transition"
                              >
                                <UserMinus className="w-4 h-4" />
                              </button>
                            )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setTransactionWallet(wallet);
                        setTransactionType('deposit');
                      }}
                    >
                      <TrendingUp className="w-4 h-4" />
                      Depositar
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setTransactionWallet(wallet);
                        setTransactionType('withdraw');
                      }}
                    >
                      <TrendingDown className="w-4 h-4" />
                      Sacar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Wallet className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Nenhuma carteira encontrada.</p>
              <Button className="mt-4" onClick={() => setIsCreateModalOpen(true)}>
                <Plus className="w-5 h-5" />
                Criar primeira carteira
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Modal Criar Carteira */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => {
            setIsCreateModalOpen(false);
            setWalletName('');
            setInitialBalance('');
          }}
          title="Nova Carteira"
          size="sm"
        >
          <form onSubmit={handleCreateWallet} className="p-6 space-y-4">
            <Input
              label="Nome da Carteira"
              value={walletName}
              onChange={(e) => setWalletName(e.target.value)}
              placeholder="Ex: Carteira do Grupo"
              required
            />
            <Input
              label="Saldo Inicial (R$)"
              type="number"
              step="0.01"
              min="0"
              value={initialBalance}
              onChange={(e) => setInitialBalance(e.target.value)}
              placeholder="0.00"
            />
            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsCreateModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Criar
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal Editar Carteira */}
        <Modal
          isOpen={!!editingWallet}
          onClose={() => {
            setEditingWallet(null);
            setWalletName('');
          }}
          title="Editar Carteira"
          size="sm"
        >
          <form onSubmit={handleUpdateWallet} className="p-6 space-y-4">
            <Input
              label="Nome da Carteira"
              value={walletName}
              onChange={(e) => setWalletName(e.target.value)}
              placeholder="Ex: Carteira do Grupo"
              required
            />
            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setEditingWallet(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Salvar
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal Gerenciar Gestores */}
        <Modal
          isOpen={!!managingWallet}
          onClose={() => {
            setManagingWallet(null);
            setAddManagerEmail('');
          }}
          title="Adicionar Gestor"
          size="sm"
        >
          <form onSubmit={handleAddManager} className="p-6 space-y-4">
            <Input
              label="Email do Gestor"
              type="email"
              value={addManagerEmail}
              onChange={(e) => setAddManagerEmail(e.target.value)}
              placeholder="gestor@email.com"
              required
            />
            <p className="text-xs text-gray-500">
              O usuário precisa ter uma conta cadastrada no sistema.
            </p>
            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setManagingWallet(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                Adicionar
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal Transação */}
        <Modal
          isOpen={!!transactionWallet}
          onClose={() => {
            setTransactionWallet(null);
            setTransactionAmount('');
            setTransactionDescription('');
          }}
          title={transactionType === 'deposit' ? 'Depositar' : 'Sacar'}
          size="sm"
        >
          <form onSubmit={handleTransaction} className="p-6 space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-sm text-gray-400">Carteira</p>
                <p className="font-medium text-white">{transactionWallet?.name}</p>
              </div>
            </div>
            <Input
              label="Valor (R$)"
              type="number"
              step="0.01"
              min="0.01"
              value={transactionAmount}
              onChange={(e) => setTransactionAmount(e.target.value)}
              placeholder="100.00"
              required
            />
            <Input
              label="Descrição (opcional)"
              value={transactionDescription}
              onChange={(e) => setTransactionDescription(e.target.value)}
              placeholder="Ex: Aporte mensal"
            />
            <div className="flex gap-3 justify-end pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setTransactionWallet(null)}
              >
                Cancelar
              </Button>
              <Button type="submit" isLoading={isSubmitting}>
                {transactionType === 'deposit' ? 'Depositar' : 'Sacar'}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal Confirmar Exclusão */}
        <Modal
          isOpen={!!deleteConfirm}
          onClose={() => setDeleteConfirm(null)}
          title="Confirmar Exclusão"
          size="sm"
        >
          <div className="p-6">
            <p className="text-gray-300 mb-6">
              Tem certeza que deseja excluir esta carteira? Todas as apostas associadas
              serão excluídas. Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                onClick={() => deleteConfirm && handleDeleteWallet(deleteConfirm)}
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
