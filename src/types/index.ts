// Tipos principais do sistema de apostas

export type BetResult = 'win' | 'loss' | 'draw' | 'pending' | 'cashout';

export type BetType =
  | 'team_a'
  | 'team_b'
  | 'draw'
  | 'team_a_or_draw'
  | 'team_b_or_draw'
  | 'team_a_or_team_b'
  | 'over'
  | 'under'
  | 'both_score_yes'
  | 'both_score_no'
  | 'other';

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: string;
}

export interface Wallet {
  id: string;
  name: string;
  balance: number;
  initial_balance: number;
  created_at: string;
  updated_at: string;
}

export interface WalletManager {
  id: string;
  wallet_id: string;
  user_id: string;
  role: 'owner' | 'manager';
  created_at: string;
  user?: User;
}

export interface Team {
  id: string;
  name: string;
  country?: string;
  logo_url?: string;
  created_at: string;
}

export interface Championship {
  id: string;
  name: string;
  country?: string;
  created_at: string;
}

export interface Bet {
  id: string;
  wallet_id: string;
  user_id: string;

  // Jogo
  team_a: string;
  team_b: string;
  championship: string;
  match_date: string;

  // Aposta
  bet_type: BetType;
  bet_type_description?: string; // Para "other"
  amount: number;
  odds: number;

  // Resultado
  result: BetResult;
  score_team_a?: number;
  score_team_b?: number;
  return_amount: number;

  // Metadados
  is_risky: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;

  // Relacionamentos
  wallet?: Wallet;
  user?: User;
}

export interface Transaction {
  id: string;
  wallet_id: string;
  user_id: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  description?: string;
  created_at: string;
}

// Estatísticas do Dashboard
export interface DashboardStats {
  total_bets: number;
  total_wins: number;
  total_losses: number;
  total_pending: number;
  win_rate: number;
  total_deposited: number;
  total_withdrawn: number;
  current_balance: number;
  total_profit: number;
  total_amount_bet: number;
  total_return: number;
  roi: number; // ROI sobre apostas (lucro / total apostado)
  roi_capital: number; // ROI sobre capital (lucro / capital inicial)
}

export interface TeamStats {
  team: string;
  total_bets: number;
  wins: number;
  losses: number;
  win_rate: number;
  profit: number;
}

export interface ChampionshipStats {
  championship: string;
  total_bets: number;
  wins: number;
  losses: number;
  win_rate: number;
  profit: number;
}

// Apostas Combinadas
export interface CombinedBetItem {
  id?: string;
  combined_bet_id?: string;
  team_a: string;
  team_b: string;
  championship: string;
  bet_type: BetType;
  bet_type_description?: string;
  created_at?: string;
}

export interface CombinedBet {
  id: string;
  wallet_id: string;
  user_id: string;
  amount: number;
  odds: number;
  result: BetResult;
  return_amount: number;
  is_risky: boolean;
  notes?: string;
  match_date: string;
  created_at: string;
  updated_at: string;
  items?: CombinedBetItem[];
  wallet?: Wallet;
}
