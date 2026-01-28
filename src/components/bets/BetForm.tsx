'use client';

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Autocomplete } from '@/components/ui/Autocomplete';
import { BET_TYPES, BET_RESULTS } from '@/lib/constants';
import { createClient } from '@/lib/supabase/client';
import type { Bet, Wallet, BetType, BetResult, Team, Championship } from '@/types';

interface BetFormProps {
  wallets: Wallet[];
  bet?: Bet | null;
  onSubmit: (data: Partial<Bet>) => Promise<void>;
  onCancel: () => void;
}

export function BetForm({ wallets, bet, onSubmit, onCancel }: BetFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [teams, setTeams] = useState<Team[]>([]);
  const [championships, setChampionships] = useState<Championship[]>([]);
  const supabase = createClient();

  const [formData, setFormData] = useState({
    wallet_id: bet?.wallet_id || wallets[0]?.id || '',
    team_a: bet?.team_a || '',
    team_b: bet?.team_b || '',
    championship: bet?.championship || '',
    match_date: bet?.match_date || new Date().toISOString().split('T')[0],
    bet_type: bet?.bet_type || 'team_a',
    bet_type_description: bet?.bet_type_description || '',
    amount: bet?.amount?.toString() || '',
    odds: bet?.odds?.toString() || '',
    result: bet?.result || 'pending',
    score_team_a: bet?.score_team_a?.toString() || '',
    score_team_b: bet?.score_team_b?.toString() || '',
    return_amount: bet?.return_amount?.toString() || '',
    is_risky: bet?.is_risky || false,
    notes: bet?.notes || '',
  });

  // Carrega times e campeonatos
  useEffect(() => {
    const loadData = async () => {
      const [teamsRes, champsRes] = await Promise.all([
        supabase.from('teams').select('*').order('name'),
        supabase.from('championships').select('*').order('name'),
      ]);
      if (teamsRes.data) setTeams(teamsRes.data);
      if (champsRes.data) setChampionships(champsRes.data);
    };
    loadData();
  }, [supabase]);

  // Calcula retorno automaticamente quando muda amount, odds ou result
  useEffect(() => {
    if (formData.result === 'win' && formData.amount && formData.odds) {
      const calculatedReturn = Number(formData.amount) * Number(formData.odds);
      setFormData((prev) => ({
        ...prev,
        return_amount: calculatedReturn.toFixed(2),
      }));
    } else if (formData.result === 'loss') {
      setFormData((prev) => ({
        ...prev,
        return_amount: '0',
      }));
    }
  }, [formData.amount, formData.odds, formData.result]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await onSubmit({
        wallet_id: formData.wallet_id,
        team_a: formData.team_a,
        team_b: formData.team_b,
        championship: formData.championship,
        match_date: formData.match_date,
        bet_type: formData.bet_type as BetType,
        bet_type_description:
          formData.bet_type === 'other' ? formData.bet_type_description : undefined,
        amount: Number(formData.amount),
        odds: Number(formData.odds),
        result: formData.result as BetResult,
        score_team_a: formData.score_team_a ? Number(formData.score_team_a) : undefined,
        score_team_b: formData.score_team_b ? Number(formData.score_team_b) : undefined,
        return_amount: Number(formData.return_amount) || 0,
        is_risky: formData.is_risky,
        notes: formData.notes || undefined,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const walletOptions = wallets.map((w) => ({ value: w.id, label: w.name }));

  const handleCreateTeam = async (name: string) => {
    const { data, error } = await supabase
      .from('teams')
      .insert({ name })
      .select()
      .single();
    if (data && !error) {
      setTeams((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    }
  };

  const handleCreateChampionship = async (name: string) => {
    const { data, error } = await supabase
      .from('championships')
      .insert({ name })
      .select()
      .single();
    if (data && !error) {
      setChampionships((prev) => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      {/* Carteira */}
      <Select
        label="Carteira"
        name="wallet_id"
        value={formData.wallet_id}
        onChange={handleChange}
        options={walletOptions}
        required
      />

      {/* Times */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Autocomplete
          label="Time A (Casa)"
          placeholder="Buscar time..."
          options={teams}
          value={formData.team_a}
          onChange={(value) => setFormData((prev) => ({ ...prev, team_a: value }))}
          onCreateNew={handleCreateTeam}
          allowCreate
          required
        />
        <Autocomplete
          label="Time B (Visitante)"
          placeholder="Buscar time..."
          options={teams}
          value={formData.team_b}
          onChange={(value) => setFormData((prev) => ({ ...prev, team_b: value }))}
          onCreateNew={handleCreateTeam}
          allowCreate
          required
        />
      </div>

      {/* Campeonato e Data */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Autocomplete
          label="Campeonato"
          placeholder="Buscar campeonato..."
          options={championships}
          value={formData.championship}
          onChange={(value) => setFormData((prev) => ({ ...prev, championship: value }))}
          onCreateNew={handleCreateChampionship}
          allowCreate
          required
        />
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Data do Jogo
          </label>
          <input
            type="date"
            name="match_date"
            value={formData.match_date}
            onChange={handleChange}
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          />
        </div>
      </div>

      {/* Tipo de Aposta */}
      <div className="space-y-4">
        <Select
          label="Tipo de Aposta"
          name="bet_type"
          value={formData.bet_type}
          onChange={handleChange}
          options={BET_TYPES}
          required
        />
        {formData.bet_type === 'other' && (
          <Input
            label="Descreva a aposta"
            name="bet_type_description"
            value={formData.bet_type_description}
            onChange={handleChange}
            placeholder="Ex: Handicap +1.5"
            required
          />
        )}
      </div>

      {/* Valor e Odds */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Valor Apostado (R$)"
          name="amount"
          type="number"
          step="0.01"
          min="0"
          value={formData.amount}
          onChange={handleChange}
          placeholder="100.00"
          required
        />
        <Input
          label="Odds"
          name="odds"
          type="number"
          step="0.01"
          min="1"
          value={formData.odds}
          onChange={handleChange}
          placeholder="1.85"
          required
        />
      </div>

      {/* Resultado */}
      <div className="space-y-4">
        <Select
          label="Resultado"
          name="result"
          value={formData.result}
          onChange={handleChange}
          options={BET_RESULTS}
        />

        {formData.result !== 'pending' && (
          <Input
            label="Retorno (R$)"
            name="return_amount"
            type="number"
            step="0.01"
            min="0"
            value={formData.return_amount}
            onChange={handleChange}
            placeholder="185.00"
          />
        )}
      </div>

      {/* Arriscado e Notas */}
      <div className="space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            name="is_risky"
            checked={formData.is_risky}
            onChange={handleChange}
            className="w-5 h-5 rounded border-gray-600 bg-gray-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-gray-900"
          />
          <span className="text-gray-300">Aposta arriscada</span>
        </label>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Observações
          </label>
          <textarea
            name="notes"
            value={formData.notes}
            onChange={handleChange}
            rows={3}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition resize-none"
            placeholder="Anotações sobre a aposta..."
          />
        </div>
      </div>

      {/* Botões */}
      <div className="flex gap-3 justify-end pt-4 border-t border-gray-800">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" isLoading={isLoading}>
          {bet ? 'Atualizar' : 'Criar'} Aposta
        </Button>
      </div>
    </form>
  );
}
