'use client';

import { useState, useEffect } from 'react';
import { X, Search, Calendar, Loader2, Trophy, ChevronLeft, ChevronRight, Circle, CheckCircle2, Clock } from 'lucide-react';
import { MAIN_LEAGUES } from '@/types/football';
import type { SimpleMatch } from '@/types/football';

type MatchStatus = 'all' | 'live' | 'finished' | 'scheduled';

interface RateLimitInfo {
  requestsRemaining: number;
  requestsLimit: number;
  lastUpdated: number;
}

interface MatchSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (match: {
    fixtureId: number;
    teamA: string;
    teamB: string;
    championship: string;
    matchDate: string;
  }) => void;
}

export function MatchSelector({ isOpen, onClose, onSelect }: MatchSelectorProps) {
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedLeague, setSelectedLeague] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<MatchStatus>('all');
  const [matches, setMatches] = useState<SimpleMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);

  // Buscar jogos quando data ou liga mudar
  useEffect(() => {
    if (!isOpen) return;

    const fetchMatches = async () => {
      setIsLoading(true);
      setError(null);

      try {
        let url = `/api/football/fixtures?date=${selectedDate}`;
        if (selectedLeague) {
          url += `&league=${selectedLeague}`;
        }

        const response = await fetch(url);
        const data = await response.json();

        if (!data.success) {
          throw new Error(data.error || 'Erro ao buscar jogos');
        }

        setMatches(data.matches);
        if (data.rateLimit) {
          setRateLimit(data.rateLimit);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao buscar jogos');
        setMatches([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMatches();
  }, [isOpen, selectedDate, selectedLeague]);

  // Verificar status do jogo
  const getMatchStatusCategory = (statusShort: string): MatchStatus => {
    const liveStatuses = ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'LIVE'];
    const finishedStatuses = ['FT', 'AET', 'PEN', 'AWD', 'WO'];
    const scheduledStatuses = ['TBD', 'NS'];

    if (liveStatuses.includes(statusShort)) return 'live';
    if (finishedStatuses.includes(statusShort)) return 'finished';
    if (scheduledStatuses.includes(statusShort)) return 'scheduled';
    return 'all';
  };

  // Filtrar jogos por termo de busca e status
  const filteredMatches = matches.filter((match) => {
    // Filtro de busca
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        match.homeTeam.toLowerCase().includes(search) ||
        match.awayTeam.toLowerCase().includes(search) ||
        match.league.toLowerCase().includes(search);
      if (!matchesSearch) return false;
    }

    // Filtro de status
    if (selectedStatus !== 'all') {
      const matchStatus = getMatchStatusCategory(match.statusShort);
      if (matchStatus !== selectedStatus) return false;
    }

    return true;
  });

  // Agrupar jogos por liga
  const matchesByLeague = filteredMatches.reduce((acc, match) => {
    const league = match.league;
    if (!acc[league]) {
      acc[league] = [];
    }
    acc[league].push(match);
    return acc;
  }, {} as Record<string, SimpleMatch[]>);

  const handleSelectMatch = (match: SimpleMatch) => {
    onSelect({
      fixtureId: match.id,
      teamA: match.homeTeam,
      teamB: match.awayTeam,
      championship: match.league,
      matchDate: match.date,
    });
    onClose();
  };

  const changeDate = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const dateOnly = new Date(date);
    dateOnly.setHours(12, 0, 0, 0);

    if (dateOnly.getTime() === today.getTime()) return 'Hoje';
    if (dateOnly.getTime() === tomorrow.getTime()) return 'Amanhã';
    if (dateOnly.getTime() === yesterday.getTime()) return 'Ontem';

    return date.toLocaleDateString('pt-BR', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NS':
      case 'TBD':
        return 'text-gray-400';
      case '1H':
      case '2H':
      case 'HT':
      case 'ET':
      case 'LIVE':
        return 'text-emerald-400';
      case 'FT':
      case 'AET':
      case 'PEN':
        return 'text-blue-400';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusText = (match: SimpleMatch) => {
    switch (match.statusShort) {
      case 'NS':
        return match.time;
      case 'HT':
        return 'Intervalo';
      case '1H':
      case '2H':
        return `${match.statusShort}`;
      case 'FT':
        return 'Encerrado';
      case 'AET':
        return 'Prorrogação';
      case 'PEN':
        return 'Pênaltis';
      default:
        return match.status;
    }
  };

  // Contadores de status
  const statusCounts = {
    all: matches.length,
    live: matches.filter(m => getMatchStatusCategory(m.statusShort) === 'live').length,
    finished: matches.filter(m => getMatchStatusCategory(m.statusShort) === 'finished').length,
    scheduled: matches.filter(m => getMatchStatusCategory(m.statusShort) === 'scheduled').length,
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Trophy className="w-5 h-5 text-emerald-400" />
            Buscar Jogo
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filtros */}
        <div className="p-4 border-b border-gray-700 space-y-3">
          {/* Data */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 bg-gray-800 rounded-lg text-gray-400 hover:text-white transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex-1 flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-white flex-1 focus:outline-none"
              />
              <span className="text-emerald-400 text-sm font-medium">
                {formatDate(selectedDate)}
              </span>
            </div>
            <button
              onClick={() => changeDate(1)}
              className="p-2 bg-gray-800 rounded-lg text-gray-400 hover:text-white transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Status do Jogo */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedStatus('all')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
                selectedStatus === 'all'
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-800/50 text-gray-400 hover:text-white'
              }`}
            >
              Todos
              <span className="text-xs opacity-70">({statusCounts.all})</span>
            </button>
            <button
              onClick={() => setSelectedStatus('live')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
                selectedStatus === 'live'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-gray-800/50 text-gray-400 hover:text-white'
              }`}
            >
              <Circle className="w-2 h-2 fill-current animate-pulse" />
              Ao Vivo
              <span className="text-xs opacity-70">({statusCounts.live})</span>
            </button>
            <button
              onClick={() => setSelectedStatus('scheduled')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
                selectedStatus === 'scheduled'
                  ? 'bg-gray-700 text-white'
                  : 'bg-gray-800/50 text-gray-400 hover:text-white'
              }`}
            >
              <Clock className="w-3 h-3" />
              Agendados
              <span className="text-xs opacity-70">({statusCounts.scheduled})</span>
            </button>
            <button
              onClick={() => setSelectedStatus('finished')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition ${
                selectedStatus === 'finished'
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-gray-800/50 text-gray-400 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              Encerrados
              <span className="text-xs opacity-70">({statusCounts.finished})</span>
            </button>
          </div>

          {/* Liga - com scroll horizontal melhorado */}
          <div className="relative">
            <div
              className="flex gap-2 overflow-x-scroll pb-2 -mx-1 px-1"
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <style jsx>{`
                div::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <button
                onClick={() => setSelectedLeague(null)}
                className={`flex-none px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition ${
                  selectedLeague === null
                    ? 'bg-emerald-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Todas Ligas
              </button>
              {MAIN_LEAGUES.map((league) => (
                <button
                  key={league.id}
                  onClick={() => setSelectedLeague(league.id)}
                  className={`flex-none px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition ${
                    selectedLeague === league.id
                      ? 'bg-emerald-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {league.name}
                </button>
              ))}
            </div>
            {/* Gradiente indicando scroll */}
            <div className="absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-gray-900 to-transparent pointer-events-none" />
          </div>

          {/* Busca */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar time ou campeonato..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Lista de Jogos */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-400">{error}</p>
              <p className="text-gray-500 text-sm mt-2">
                Verifique sua conexão ou tente novamente mais tarde
              </p>
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="text-center py-8">
              <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">Nenhum jogo encontrado</p>
              <p className="text-gray-500 text-sm mt-1">
                Tente outra data, campeonato ou filtro de status
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(matchesByLeague).map(([league, leagueMatches]) => (
                <div key={league}>
                  <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                    {leagueMatches[0]?.leagueLogo && (
                      <img
                        src={leagueMatches[0].leagueLogo}
                        alt={league}
                        className="w-4 h-4 object-contain"
                      />
                    )}
                    {league}
                    <span className="text-gray-600">({leagueMatches.length})</span>
                  </h3>
                  <div className="space-y-2">
                    {leagueMatches.map((match) => (
                      <button
                        key={match.id}
                        onClick={() => handleSelectMatch(match)}
                        className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg p-3 transition text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            {/* Time da Casa */}
                            <div className="flex items-center gap-2 mb-1">
                              {match.homeTeamLogo && (
                                <img
                                  src={match.homeTeamLogo}
                                  alt={match.homeTeam}
                                  className="w-5 h-5 object-contain"
                                />
                              )}
                              <span className="text-white font-medium">
                                {match.homeTeam}
                              </span>
                              {match.homeGoals !== null && (
                                <span className="text-white font-bold ml-auto">
                                  {match.homeGoals}
                                </span>
                              )}
                            </div>
                            {/* Time Visitante */}
                            <div className="flex items-center gap-2">
                              {match.awayTeamLogo && (
                                <img
                                  src={match.awayTeamLogo}
                                  alt={match.awayTeam}
                                  className="w-5 h-5 object-contain"
                                />
                              )}
                              <span className="text-white font-medium">
                                {match.awayTeam}
                              </span>
                              {match.awayGoals !== null && (
                                <span className="text-white font-bold ml-auto">
                                  {match.awayGoals}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Status */}
                          <div className={`text-sm ml-4 ${getStatusColor(match.statusShort)}`}>
                            {getStatusText(match)}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer com indicador de requests */}
        <div className="p-4 border-t border-gray-700 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Dados: API-Football
          </p>
          {rateLimit && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-16 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    rateLimit.requestsRemaining > 50
                      ? 'bg-emerald-500'
                      : rateLimit.requestsRemaining > 20
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  }`}
                  style={{ width: `${(rateLimit.requestsRemaining / rateLimit.requestsLimit) * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">
                {rateLimit.requestsRemaining}/{rateLimit.requestsLimit}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
