'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';
import { Check, Key, Loader2, Pencil, Plus, Trash2, Trophy, Users, X } from 'lucide-react';
import type { Team, Championship } from '@/types';

export default function SettingsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form states
  const [newTeamName, setNewTeamName] = useState('');
  const [newChampionshipName, setNewChampionshipName] = useState('');

  const [isAddingTeam, setIsAddingTeam] = useState(false);
  const [isAddingChampionship, setIsAddingChampionship] = useState(false);

  // Edit states
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState('');
  const [editingChampionshipId, setEditingChampionshipId] = useState<string | null>(null);
  const [editingChampionshipName, setEditingChampionshipName] = useState('');
  const [isSavingTeam, setIsSavingTeam] = useState(false);
  const [isSavingChampionship, setIsSavingChampionship] = useState(false);

  // Password change states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);

    const [teamsResult, championshipsResult] = await Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('championships').select('*').order('name'),
    ]);

    if (teamsResult.data) setTeams(teamsResult.data);
    if (championshipsResult.data) setChampionships(championshipsResult.data);

    setIsLoading(false);
  };

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    setIsAddingTeam(true);

    const { error } = await supabase.from('teams').insert({
      name: newTeamName.trim(),
    });

    if (!error) {
      setNewTeamName('');
      loadData();
    } else {
      alert('Erro ao adicionar time: ' + error.message);
    }

    setIsAddingTeam(false);
  };

  const handleAddChampionship = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChampionshipName.trim()) return;

    setIsAddingChampionship(true);

    const { error } = await supabase.from('championships').insert({
      name: newChampionshipName.trim(),
    });

    if (!error) {
      setNewChampionshipName('');
      loadData();
    } else {
      alert('Erro ao adicionar campeonato: ' + error.message);
    }

    setIsAddingChampionship(false);
  };

  const handleDeleteTeam = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este time?')) return;

    const { error } = await supabase.from('teams').delete().eq('id', id);
    if (!error) {
      loadData();
    }
  };

  const handleDeleteChampionship = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este campeonato?')) return;

    const { error } = await supabase.from('championships').delete().eq('id', id);
    if (!error) {
      loadData();
    }
  };

  const startEditingTeam = (team: Team) => {
    setEditingTeamId(team.id);
    setEditingTeamName(team.name);
  };

  const cancelEditingTeam = () => {
    setEditingTeamId(null);
    setEditingTeamName('');
  };

  const handleEditTeam = async (oldName: string) => {
    if (!editingTeamName.trim() || !editingTeamId) return;
    if (editingTeamName.trim() === oldName) {
      cancelEditingTeam();
      return;
    }

    setIsSavingTeam(true);

    const newName = editingTeamName.trim();

    // Atualizar o time na tabela teams
    const { error: teamError } = await supabase
      .from('teams')
      .update({ name: newName })
      .eq('id', editingTeamId);

    if (teamError) {
      alert('Erro ao atualizar time: ' + teamError.message);
      setIsSavingTeam(false);
      return;
    }

    // Atualizar em todas as apostas simples (team_a e team_b)
    await supabase
      .from('bets')
      .update({ team_a: newName })
      .eq('team_a', oldName);

    await supabase
      .from('bets')
      .update({ team_b: newName })
      .eq('team_b', oldName);

    // Atualizar em todas as apostas combinadas (combined_bet_items)
    await supabase
      .from('combined_bet_items')
      .update({ team_a: newName })
      .eq('team_a', oldName);

    await supabase
      .from('combined_bet_items')
      .update({ team_b: newName })
      .eq('team_b', oldName);

    setIsSavingTeam(false);
    cancelEditingTeam();
    loadData();
  };

  const startEditingChampionship = (championship: Championship) => {
    setEditingChampionshipId(championship.id);
    setEditingChampionshipName(championship.name);
  };

  const cancelEditingChampionship = () => {
    setEditingChampionshipId(null);
    setEditingChampionshipName('');
  };

  const handleEditChampionship = async (oldName: string) => {
    if (!editingChampionshipName.trim() || !editingChampionshipId) return;
    if (editingChampionshipName.trim() === oldName) {
      cancelEditingChampionship();
      return;
    }

    setIsSavingChampionship(true);

    const newName = editingChampionshipName.trim();

    // Atualizar o campeonato na tabela championships
    const { error: champError } = await supabase
      .from('championships')
      .update({ name: newName })
      .eq('id', editingChampionshipId);

    if (champError) {
      alert('Erro ao atualizar campeonato: ' + champError.message);
      setIsSavingChampionship(false);
      return;
    }

    // Atualizar em todas as apostas simples
    await supabase
      .from('bets')
      .update({ championship: newName })
      .eq('championship', oldName);

    // Atualizar em todas as apostas combinadas (combined_bet_items)
    await supabase
      .from('combined_bet_items')
      .update({ championship: newName })
      .eq('championship', oldName);

    setIsSavingChampionship(false);
    cancelEditingChampionship();
    loadData();
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    // Validações
    if (newPassword.length < 6) {
      setPasswordError('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem');
      return;
    }

    setIsChangingPassword(true);

    try {
      // Primeiro, verificar a senha atual fazendo login novamente
      const { data: { user } } = await supabase.auth.getUser();

      if (!user?.email) {
        setPasswordError('Erro ao obter dados do usuário');
        setIsChangingPassword(false);
        return;
      }

      // Tentar fazer login com a senha atual para verificar
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        setPasswordError('Senha atual incorreta');
        setIsChangingPassword(false);
        return;
      }

      // Atualizar a senha
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setPasswordError('Erro ao atualizar senha: ' + updateError.message);
        setIsChangingPassword(false);
        return;
      }

      // Sucesso
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Esconder mensagem de sucesso após 3 segundos
      setTimeout(() => setPasswordSuccess(false), 3000);
    } catch {
      setPasswordError('Erro inesperado ao alterar senha');
    }

    setIsChangingPassword(false);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Configurações</h1>
          <p className="text-gray-400">Gerencie sua conta, times e campeonatos</p>
        </div>

        {/* Alterar Senha */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-white">Alterar Senha</h2>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Senha atual
                </label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Digite sua senha atual"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Nova senha
                </label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite a nova senha"
                  minLength={6}
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Mínimo de 6 caracteres</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Confirmar nova senha
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme a nova senha"
                  minLength={6}
                  required
                />
              </div>

              {passwordError && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-3 text-red-400 text-sm">
                  {passwordError}
                </div>
              )}

              {passwordSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/50 rounded-lg p-3 text-emerald-400 text-sm">
                  Senha alterada com sucesso!
                </div>
              )}

              <Button type="submit" disabled={isChangingPassword}>
                {isChangingPassword ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Alterando...
                  </>
                ) : (
                  'Alterar Senha'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Times */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-lg font-semibold text-white">Times</h2>
                  <span className="text-sm text-gray-400">({teams.length})</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Formulário de adicionar */}
                <form onSubmit={handleAddTeam} className="flex gap-2">
                  <Input
                    placeholder="Nome do time"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    required
                  />
                  <Button type="submit" size="sm" isLoading={isAddingTeam}>
                    <Plus className="w-4 h-4" />
                    Adicionar
                  </Button>
                </form>

                {/* Lista de times */}
                <div className="max-h-80 overflow-y-auto space-y-1">
                  {teams.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">
                      Nenhum time cadastrado
                    </p>
                  ) : (
                    teams.map((team) => (
                      <div
                        key={team.id}
                        className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg group"
                      >
                        {editingTeamId === team.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              value={editingTeamName}
                              onChange={(e) => setEditingTeamName(e.target.value)}
                              className="flex-1 h-8 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleEditTeam(team.name);
                                } else if (e.key === 'Escape') {
                                  cancelEditingTeam();
                                }
                              }}
                            />
                            <button
                              onClick={() => handleEditTeam(team.name)}
                              disabled={isSavingTeam}
                              className="p-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEditingTeam}
                              disabled={isSavingTeam}
                              className="p-1 text-gray-400 hover:text-gray-300 disabled:opacity-50"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-white">{team.name}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                              <button
                                onClick={() => startEditingTeam(team)}
                                className="p-1 text-gray-500 hover:text-blue-400"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteTeam(team.id)}
                                className="p-1 text-gray-500 hover:text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Campeonatos */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-yellow-400" />
                  <h2 className="text-lg font-semibold text-white">Campeonatos</h2>
                  <span className="text-sm text-gray-400">({championships.length})</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Formulário de adicionar */}
                <form onSubmit={handleAddChampionship} className="flex gap-2">
                  <Input
                    placeholder="Nome do campeonato"
                    value={newChampionshipName}
                    onChange={(e) => setNewChampionshipName(e.target.value)}
                    required
                  />
                  <Button type="submit" size="sm" isLoading={isAddingChampionship}>
                    <Plus className="w-4 h-4" />
                    Adicionar
                  </Button>
                </form>

                {/* Lista de campeonatos */}
                <div className="max-h-80 overflow-y-auto space-y-1">
                  {championships.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">
                      Nenhum campeonato cadastrado
                    </p>
                  ) : (
                    championships.map((championship) => (
                      <div
                        key={championship.id}
                        className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg group"
                      >
                        {editingChampionshipId === championship.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              value={editingChampionshipName}
                              onChange={(e) => setEditingChampionshipName(e.target.value)}
                              className="flex-1 h-8 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleEditChampionship(championship.name);
                                } else if (e.key === 'Escape') {
                                  cancelEditingChampionship();
                                }
                              }}
                            />
                            <button
                              onClick={() => handleEditChampionship(championship.name)}
                              disabled={isSavingChampionship}
                              className="p-1 text-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={cancelEditingChampionship}
                              disabled={isSavingChampionship}
                              className="p-1 text-gray-400 hover:text-gray-300 disabled:opacity-50"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <>
                            <span className="text-white">{championship.name}</span>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                              <button
                                onClick={() => startEditingChampionship(championship)}
                                className="p-1 text-gray-500 hover:text-blue-400"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteChampionship(championship.id)}
                                className="p-1 text-gray-500 hover:text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
