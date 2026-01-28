export const BET_TYPES = [
  { value: 'team_a', label: 'Time A' },
  { value: 'team_b', label: 'Time B' },
  { value: 'draw', label: 'Empate' },
  { value: 'team_a_or_draw', label: 'Time A ou Empate' },
  { value: 'team_b_or_draw', label: 'Time B ou Empate' },
  { value: 'team_a_or_team_b', label: 'Time A ou Time B' },
  { value: 'over', label: 'Over (mais gols)' },
  { value: 'under', label: 'Under (menos gols)' },
  { value: 'both_score_yes', label: 'Ambos Marcam - Sim' },
  { value: 'both_score_no', label: 'Ambos Marcam - Não' },
  { value: 'other', label: 'Outro' },
];

export const BET_RESULTS = [
  { value: 'pending', label: 'Pendente' },
  { value: 'win', label: 'Ganhou' },
  { value: 'loss', label: 'Perdeu' },
  { value: 'cashout', label: 'Cashout' },
];

export const RESULT_COLORS = {
  pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  win: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  loss: 'bg-red-500/10 text-red-400 border-red-500/30',
  draw: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  cashout: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

export const RESULT_LABELS = {
  pending: 'Pendente',
  win: 'Ganhou',
  loss: 'Perdeu',
  draw: 'Empate',
  cashout: 'Cashout',
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

export const formatDate = (date: string): string => {
  return new Date(date).toLocaleDateString('pt-BR');
};
