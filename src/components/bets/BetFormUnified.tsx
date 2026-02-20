'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Autocomplete } from '@/components/ui/Autocomplete';
import { MatchSelector } from '@/components/bets/MatchSelector';
import { BET_TYPES, BET_RESULTS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import { Plus, Trash2, Layers, Receipt, Search } from 'lucide-react';
import type { Bet, Wallet, BetType, BetResult, Team, Championship, CombinedBetItem } from '@/types';

interface BetFormUnifiedProps {
  wallets: Wallet[];
  onSubmitSimple: (data: Partial<Bet>) => Promise<void>;
  onSubmitCombined: (data: {
    wallet_id: string;
    amount: number;
    odds: number;
    result: BetResult;
    return_amount: number;
    is_risky: boolean;
    notes?: string;
    items: CombinedBetItem[];
  }) => Promise<void>;
  onCancel: () => void;
}

export function BetFormUnified({
  wallets,
  onSubmitSimple,
  onSubmitCombined,
  onCancel,
}: BetFormUnifiedProps) {
  const [betMode, setBetMode] = useState<'simple' | 'combined'>('simple');
  const [isLoading, setIsLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [championships, setChampionships] = useState<Championship[]>([]);
  const [showMatchSelector, setShowMatchSelector] = useState(false);
  const supabase = createClient();

  // Estado para aposta simples
  const [simpleForm, setSimpleForm] = useState({
    wallet_id: wallets[0]?.id || '',
    team_a: '',
    team_b: '',
    championship: '',
    bet_type: 'team_a' as BetType,
    bet_type_description: '',
    amount: '',
    odds: '',
    result: 'pending' as BetResult,
    return_amount: '',
    is_risky: false,
    notes: '',
  });

  // Estado para aposta combinada
  const [combinedForm, setCombinedForm] = useState({
    wallet_id: wallets[0]?.id || '',
    amount: '',
    odds: '',
    result: 'pending' as BetResult,
    return_amount: '',
    is_risky: false,
    notes: '',
  });

  // Jogos da combinada
  const [combinedItems, setCombinedItems] = useState<CombinedBetItem[]>([]);
  const [currentItem, setCurrentItem] = useState<CombinedBetItem>({
    team_a: '',
    team_b: '',
    championship: '',
    bet_type: 'team_a',
    bet_type_description: '',
  });

  useEffect(() => {
    loadTeamsAndChampionships();
  }, []);

  // Calcular retorno automaticamente para aposta simples
  useEffect(() => {
    if (simpleForm.result === 'win' && simpleForm.amount && simpleForm.odds) {
      const calculatedReturn = Number(simpleForm.amount) * Number(simpleForm.odds);
      setSimpleForm((prev) => ({ ...prev, return_amount: calculatedReturn.toFixed(2) }));
    } else if (simpleForm.result === 'loss') {
      setSimpleForm((prev) => ({ ...prev, return_amount: '0' }));
    }
  }, [simpleForm.amount, simpleForm.odds, simpleForm.result]);

  // Calcular retorno automaticamente para combinada
  useEffect(() => {
    if (combinedForm.result === 'win' && combinedForm.amount && combinedForm.odds) {
      const calculatedReturn = Number(combinedForm.amount) * Number(combinedForm.odds);
      setCombinedForm((prev) => ({ ...prev, return_amount: calculatedReturn.toFixed(2) }));
    } else if (combinedForm.result === 'loss') {
      setCombinedForm((prev) => ({ ...prev, return_amount: '0' }));
    }
  }, [combinedForm.amount, combinedForm.odds, combinedForm.result]);

  const loadTeamsAndChampionships = async () => {
    const [teamsRes, champsRes] = await Promise.all([
      supabase.from('teams').select('*').order('name'),
      supabase.from('championships').select('*').order('name'),
    ]);
    if (teamsRes.data) setTeams(teamsRes.data);
    if (champsRes.data) setChampionships(champsRes.data);
  };

  const handleCreateTeam = async (name: string) => {
    const { data, error } = await supabase.from('teams').insert({ name }).select().single();
    if (data && !error) {
      setTeams((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    }
  };

  const handleCreateChampionship = async (name: string) => {
    const { data, error } = await supabase.from('championships').insert({ name }).select().single();
    if (data && !error) {
      setChampionships((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    }
  };

  const handleSimpleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setSimpleForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleCombinedChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setCombinedForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const addItemToCombined = () => {
    if (!currentItem.team_a || !currentItem.team_b || !currentItem.championship) {
      alert('Preencha todos os campos do jogo');
      return;
    }
    setCombinedItems((prev) => [...prev, currentItem]);
    setCurrentItem({
      team_a: '',
      team_b: '',
      championship: '',
      bet_type: 'team_a',
      bet_type_description: '',
    });
  };

  const removeItemFromCombined = (index: number) => {
    setCombinedItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (betMode === 'simple') {
        await onSubmitSimple({
          wallet_id: simpleForm.wallet_id,
          team_a: simpleForm.team_a,
          team_b: simpleForm.team_b,
          championship: simpleForm.championship,
          bet_type: simpleForm.bet_type,
          bet_type_description:
            simpleForm.bet_type === 'other' ? simpleForm.bet_type_description : undefined,
          amount: Number(simpleForm.amount),
          odds: Number(simpleForm.odds),
          result: simpleForm.result,
          return_amount: Number(simpleForm.return_amount) || 0,
          is_risky: simpleForm.is_risky,
          notes: simpleForm.notes || undefined,
        });
      } else {
        if (combinedItems.length < 2) {
          alert('Uma aposta combinada precisa ter pelo menos 2 jogos');
          setIsLoading(false);
          return;
        }
        await onSubmitCombined({
          wallet_id: combinedForm.wallet_id,
          amount: Number(combinedForm.amount),
          odds: Number(combinedForm.odds),
          result: combinedForm.result,
          return_amount: Number(combinedForm.return_amount) || 0,
          is_risky: combinedForm.is_risky,
          notes: combinedForm.notes || undefined,
          items: combinedItems,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const walletOptions = wallets.map((w) => ({ value: w.id, label: w.name }));

  const getBetTypeLabel = (type: string) => {
    return BET_TYPES.find((t) => t.value === type)?.label || type;
  };

  const handleMatchSelect = async (match: {
    teamA: string;
    teamB: string;
    championship: string;
    matchDate: string;
  }) => {
    // Criar times automaticamente se não existirem
    const createTeamIfNeeded = async (name: string) => {
      const exists = teams.some(
        (t) => t.name.toLowerCase() === name.toLowerCase()
      );
      if (!exists) {
        await handleCreateTeam(name);
      }
    };

    // Criar campeonato automaticamente se não existir
    const createChampionshipIfNeeded = async (name: string) => {
      const exists = championships.some(
        (c) => c.name.toLowerCase() === name.toLowerCase()
      );
      if (!exists) {
        await handleCreateChampionship(name);
      }
    };

    // Criar entidades se necessário
    await Promise.all([
      createTeamIfNeeded(match.teamA),
      createTeamIfNeeded(match.teamB),
      createChampionshipIfNeeded(match.championship),
    ]);

    // Atualizar formulário baseado no modo atual
    if (betMode === 'simple') {
      setSimpleForm((prev) => ({
        ...prev,
        team_a: match.teamA,
        team_b: match.teamB,
        championship: match.championship,
      }));
    } else {
      // Para combinada, preenche o item atual
      setCurrentItem((prev) => ({
        ...prev,
        team_a: match.teamA,
        team_b: match.teamB,
        championship: match.championship,
      }));
    }
  };

  return (
    <>
      <MatchSelector
        isOpen={showMatchSelector}
        onClose={() => setShowMatchSelector(false)}
        onSelect={handleMatchSelect}
      />

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
      {/* Seletor de modo */}
      <div className="flex gap-2 p-1 bg-gray-800 rounded-lg">
        <button
          type="button"
          onClick={() => setBetMode('simple')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md transition ${
            betMode === 'simple'
              ? 'bg-emerald-500 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Simples
        </button>
        <button
          type="button"
          onClick={() => setBetMode('combined')}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md transition ${
            betMode === 'combined'
              ? 'bg-emerald-500 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Layers className="w-4 h-4" />
          Combinada
        </button>
      </div>

      {betMode === 'simple' ? (
        /* ===== FORMULÁRIO SIMPLES ===== */
        <>
          <Select
            label="Carteira"
            name="wallet_id"
            value={simpleForm.wallet_id}
            onChange={handleSimpleChange}
            options={walletOptions}
            required
          />

          {/* Buscar Jogo */}
          <button
            type="button"
            onClick={() => setShowMatchSelector(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 rounded-lg text-gray-300 hover:text-white transition"
          >
            <Search className="w-4 h-4" />
            Buscar Jogo (Auto-preencher times e campeonato)
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Autocomplete
              label="Time A (Casa)"
              placeholder="Buscar time..."
              options={teams}
              value={simpleForm.team_a}
              onChange={(value) => setSimpleForm((prev) => ({ ...prev, team_a: value }))}
              onCreateNew={handleCreateTeam}
              allowCreate
              required
            />
            <Autocomplete
              label="Time B (Visitante)"
              placeholder="Buscar time..."
              options={teams}
              value={simpleForm.team_b}
              onChange={(value) => setSimpleForm((prev) => ({ ...prev, team_b: value }))}
              onCreateNew={handleCreateTeam}
              allowCreate
              required
            />
          </div>

          <Autocomplete
            label="Campeonato"
            placeholder="Buscar campeonato..."
            options={championships}
            value={simpleForm.championship}
            onChange={(value) => setSimpleForm((prev) => ({ ...prev, championship: value }))}
            onCreateNew={handleCreateChampionship}
            allowCreate
            required
          />

          <div className="space-y-4">
            <Select
              label="Tipo de Aposta"
              name="bet_type"
              value={simpleForm.bet_type}
              onChange={handleSimpleChange}
              options={BET_TYPES}
              required
            />
            {simpleForm.bet_type === 'other' && (
              <Input
                label="Descreva a aposta"
                name="bet_type_description"
                value={simpleForm.bet_type_description}
                onChange={handleSimpleChange}
                placeholder="Ex: Handicap +1.5"
                required
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Valor Apostado (R$)"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              value={simpleForm.amount}
              onChange={handleSimpleChange}
              placeholder="100.00"
              required
            />
            <Input
              label="Odds"
              name="odds"
              type="number"
              step="0.01"
              min="1"
              value={simpleForm.odds}
              onChange={handleSimpleChange}
              placeholder="1.85"
              required
            />
          </div>

          <div className="space-y-4">
            <Select
              label="Resultado"
              name="result"
              value={simpleForm.result}
              onChange={handleSimpleChange}
              options={BET_RESULTS}
            />
            {simpleForm.result !== 'pending' && (
              <Input
                label="Retorno (R$)"
                name="return_amount"
                type="number"
                step="0.01"
                min="0"
                value={simpleForm.return_amount}
                onChange={handleSimpleChange}
                placeholder="185.00"
              />
            )}
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="is_risky"
                checked={simpleForm.is_risky}
                onChange={handleSimpleChange}
                className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-gray-900"
              />
              <span className="text-gray-300">Aposta arriscada</span>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Observações</label>
              <textarea
                name="notes"
                value={simpleForm.notes}
                onChange={handleSimpleChange}
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-none"
                placeholder="Anotações sobre a aposta..."
              />
            </div>
          </div>
        </>
      ) : (
        /* ===== FORMULÁRIO COMBINADA ===== */
        <>
          <Select
            label="Carteira"
            name="wallet_id"
            value={combinedForm.wallet_id}
            onChange={handleCombinedChange}
            options={walletOptions}
            required
          />

          {/* Adicionar jogo */}
          <div className="bg-gray-800/50 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-300">Adicionar Jogo</h3>
              <button
                type="button"
                onClick={() => setShowMatchSelector(true)}
                className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-gray-300 hover:text-white text-sm transition"
              >
                <Search className="w-3 h-3" />
                Buscar
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Autocomplete
                placeholder="Time A..."
                options={teams}
                value={currentItem.team_a}
                onChange={(value) => setCurrentItem((prev) => ({ ...prev, team_a: value }))}
                onCreateNew={handleCreateTeam}
                allowCreate
              />
              <Autocomplete
                placeholder="Time B..."
                options={teams}
                value={currentItem.team_b}
                onChange={(value) => setCurrentItem((prev) => ({ ...prev, team_b: value }))}
                onCreateNew={handleCreateTeam}
                allowCreate
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Autocomplete
                placeholder="Campeonato..."
                options={championships}
                value={currentItem.championship}
                onChange={(value) => setCurrentItem((prev) => ({ ...prev, championship: value }))}
                onCreateNew={handleCreateChampionship}
                allowCreate
              />
              <Select
                name="bet_type"
                value={currentItem.bet_type}
                onChange={(e) =>
                  setCurrentItem((prev) => ({ ...prev, bet_type: e.target.value as BetType }))
                }
                options={BET_TYPES}
              />
            </div>

            {currentItem.bet_type === 'other' && (
              <Input
                placeholder="Descreva a aposta"
                value={currentItem.bet_type_description || ''}
                onChange={(e) =>
                  setCurrentItem((prev) => ({ ...prev, bet_type_description: e.target.value }))
                }
              />
            )}

            <Button type="button" variant="secondary" size="sm" onClick={addItemToCombined}>
              <Plus className="w-4 h-4" />
              Adicionar Jogo
            </Button>
          </div>

          {/* Lista de jogos adicionados */}
          {combinedItems.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-gray-300">
                Jogos na Combinada ({combinedItems.length})
              </h3>
              {combinedItems.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium truncate">
                      {item.team_a} x {item.team_b}
                    </p>
                    <p className="text-gray-400 text-sm truncate">
                      {item.championship} • {getBetTypeLabel(item.bet_type)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItemFromCombined(index)}
                    className="p-1 text-gray-500 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Valores da combinada */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Valor Apostado (R$)"
              name="amount"
              type="number"
              step="0.01"
              min="0"
              value={combinedForm.amount}
              onChange={handleCombinedChange}
              placeholder="100.00"
              required
            />
            <Input
              label="Odds Total"
              name="odds"
              type="number"
              step="0.01"
              min="1"
              value={combinedForm.odds}
              onChange={handleCombinedChange}
              placeholder="5.50"
              required
            />
          </div>

          <div className="space-y-4">
            <Select
              label="Resultado"
              name="result"
              value={combinedForm.result}
              onChange={handleCombinedChange}
              options={BET_RESULTS}
            />
            {combinedForm.result !== 'pending' && (
              <Input
                label="Retorno (R$)"
                name="return_amount"
                type="number"
                step="0.01"
                min="0"
                value={combinedForm.return_amount}
                onChange={handleCombinedChange}
                placeholder="550.00"
              />
            )}
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="is_risky"
                checked={combinedForm.is_risky}
                onChange={handleCombinedChange}
                className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-gray-900"
              />
              <span className="text-gray-300">Aposta arriscada</span>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Observações</label>
              <textarea
                name="notes"
                value={combinedForm.notes}
                onChange={handleCombinedChange}
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-none"
                placeholder="Anotações sobre a aposta..."
              />
            </div>
          </div>
        </>
      )}

      {/* Botões */}
        <div className="flex gap-3 justify-end pt-4 border-t border-gray-800">
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Criar Aposta
          </Button>
        </div>
      </form>
    </>
  );
}
