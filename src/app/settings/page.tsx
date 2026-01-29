'use client';

import { useEffect, useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';
import { Plus, Trash2, Trophy, Users } from 'lucide-react';
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

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Configurações</h1>
          <p className="text-gray-400">Gerencie times e campeonatos</p>
        </div>

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
                        <span className="text-white">{team.name}</span>
                        <button
                          onClick={() => handleDeleteTeam(team.id)}
                          className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
                        <span className="text-white">{championship.name}</span>
                        <button
                          onClick={() => handleDeleteChampionship(championship.id)}
                          className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
