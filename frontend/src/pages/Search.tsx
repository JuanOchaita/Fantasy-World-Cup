import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Search as SearchIcon, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import AppLayout from '@/components/AppLayout';
import {
  playerService,
  type Player,
  type ExternalPlayerDetail,
  type ExternalSearchResult,
  type RedisPlayerSuggestion,
} from '@/services/players';
import { mapSquadDetails, squadService, type Squad } from '@/services/squad';
import { firstEmptySlotForPosition, getFormationShape, getFormationSlots } from '@/lib/squadSlots';
import { useToast } from '@/hooks/use-toast';
import { COUNTRY_OPTIONS } from '@/lib/countries';

const positions = ['GK', 'DEF', 'MID', 'FWD'] as const;
const positionFilterMap: Record<(typeof positions)[number], string> = {
  GK: 'GK',
  DEF: 'DEF,CB,LB,RB,LWB,RWB',
  MID: 'MID,CDM,CM,CAM,LM,RM',
  FWD: 'FWD,ST,CF,LW,RW,LF,RF,LS,RS',
};

const positionColors: Record<string, string> = {
  GK: 'bg-amber-500/20 text-amber-400',
  DEF: 'bg-blue-500/20 text-blue-400',
  MID: 'bg-emerald-500/20 text-emerald-400',
  FWD: 'bg-red-500/20 text-red-400',
};

function parsePlayerPositions(raw?: string): string[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(',')
        .map(p => p.trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

function getPositionTagClass(position: string): string {
  if (position === 'GK') return positionColors.GK;
  if (/LB|RB|CB|LWB|RWB|DEF|DF/.test(position)) return positionColors.DEF;
  if (/ST|CF|LW|RW|LF|RF|FWD|LS|RS/.test(position)) return positionColors.FWD;
  return positionColors.MID;
}

function formatStatKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, m => m.toUpperCase());
}

const detailedStatSections = [
  {
    title: 'Attacking',
    metrics: [
      ['attacking_crossing', 'Crossing'],
      ['attacking_finishing', 'Finishing'],
      ['attacking_heading_accuracy', 'Heading Accuracy'],
      ['attacking_short_passing', 'Short Passing'],
      ['attacking_volleys', 'Volleys'],
    ] as const,
  },
  {
    title: 'Mentality',
    metrics: [
      ['mentality_aggression', 'Aggression'],
      ['mentality_interceptions', 'Interceptions'],
      ['mentality_positioning', 'Positioning'],
      ['mentality_vision', 'Vision'],
      ['mentality_penalties', 'Penalties'],
      ['mentality_composure', 'Composure'],
    ] as const,
  },
  {
    title: 'Defense',
    metrics: [
      ['defending_marking_awareness', 'Marking'],
      ['defending_standing_tackle', 'Stand Tackle'],
      ['defending_sliding_tackle', 'Slide Tackle'],
    ] as const,
  },
  {
    title: 'Goalkeeping',
    metrics: [
      ['goalkeeping_diving', 'Diving'],
      ['goalkeeping_handling', 'Handling'],
      ['goalkeeping_kicking', 'Kicking'],
      ['goalkeeping_positioning', 'Positioning'],
      ['goalkeeping_reflexes', 'Reflexes'],
    ] as const,
  },
];

const positionRatings = [
  'st', 'ls', 'rs', 'lw', 'rw', 'lf', 'rf', 'cf',
  'cam', 'lam', 'ram', 'cm', 'lcm', 'rcm', 'cdm', 'ldm', 'rdm',
  'lm', 'rm', 'lb', 'rb', 'lwb', 'rwb', 'lcb', 'rcb', 'cb', 'gk',
] as const;

function formatStatValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function normalizeImageUrl(raw?: string): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    return encodeURI(trimmed);
  } catch {
    return undefined;
  }
}

const SearchPage = () => {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  /** Text sent to Elasticsearch; only set on Enter (or suggestion pick). `null` = no search run yet. */
  const [submittedSearchQ, setSubmittedSearchQ] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<ExternalSearchResult[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [selectedNationality, setSelectedNationality] = useState('');
  const [selectedPosition, setSelectedPosition] = useState('');
  const [selectedClub, setSelectedClub] = useState('');
  const [minOverall, setMinOverall] = useState('0');
  const [maxOverall, setMaxOverall] = useState('99');
  const [suggestions, setSuggestions] = useState<RedisPlayerSuggestion[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [detailCache, setDetailCache] = useState<Record<number, ExternalPlayerDetail>>({});
  const [detailLoading, setDetailLoading] = useState(false);
  const [clubOptions, setClubOptions] = useState<string[]>([]);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [squad, setSquad] = useState<Squad | null>(null);
  const [squadLoading, setSquadLoading] = useState(true);
  /** Per search row: which line (GK/DEF/MID/FWD) to place the player when adding. */
  const [addAsRoleByPlayerId, setAddAsRoleByPlayerId] = useState<Record<string, Player['position']>>({});
  const skipNextSuggestFetchRef = useRef(false);

  const getAddAsRole = (player: Player): Player['position'] =>
    addAsRoleByPlayerId[player.id] ?? player.position;

  const refreshSquad = useCallback(async () => {
    try {
      const details = await squadService.getDetails();
      setSquad(mapSquadDetails(details));
    } catch {
      setSquad(null);
    } finally {
      setSquadLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSquad();
  }, [refreshSquad]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (skipNextSuggestFetchRef.current) {
      skipNextSuggestFetchRef.current = false;
      return;
    }
    if (!debouncedQuery) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    playerService
      .suggestByName(debouncedQuery)
      .then(data => {
        if (!cancelled) setSuggestions(data.slice(0, 6));
      })
      .catch(() => {
        if (!cancelled) setSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    if (submittedSearchQ === null) {
      setSearchResults([]);
      setTotalPages(1);
      setTotalItems(0);
      setListLoading(false);
      return;
    }
    let cancelled = false;
    setListLoading(true);
    playerService
      .searchAdvanced({
        q: submittedSearchQ,
        page: currentPage,
        size: 50,
        nationality: selectedNationality || undefined,
        positions: selectedPosition ? positionFilterMap[selectedPosition as keyof typeof positionFilterMap] : undefined,
        club: selectedClub || undefined,
        min_overall: Number(minOverall),
        max_overall: Number(maxOverall),
      })
      .then(res => {
        if (cancelled) return;
        setSearchResults(res.results);
        setTotalPages(res.pagination.total_pages || 1);
        setTotalItems(res.pagination.total_items || 0);
        setClubOptions(prev =>
          Array.from(new Set([...prev, ...res.results.map(x => x.club_name).filter((x): x is string => !!x)])).sort()
        );
      })
      .catch(e => {
        if (cancelled) return;
        toast({
          title: 'Search failed',
          description: e instanceof Error ? e.message : 'Could not search players',
          variant: 'destructive',
        });
        setSearchResults([]);
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [submittedSearchQ, currentPage, selectedNationality, selectedPosition, selectedClub, minOverall, maxOverall, toast]);

  const players = useMemo(
    () =>
      searchResults.map(p => {
        const positionList = parsePlayerPositions(p.player_positions);
        const pos = positionList.join(',') || (p.player_positions || '').toUpperCase();
        const mappedPosition: Player['position'] = pos.includes('GK')
          ? 'GK'
          : /LB|RB|CB|LWB|RWB|DEF|DF/.test(pos)
          ? 'DEF'
          : /ST|CF|LW|RW|LF|RF|FWD|LS|RS/.test(pos)
          ? 'FWD'
          : 'MID';
        return {
          id: String(p.player_id),
          name: p.long_name,
          position: mappedPosition,
          positions: positionList.length > 0 ? positionList : [mappedPosition],
          team: p.club_name || '—',
          nationality: p.nationality_name || '—',
          price: Math.max(0, (p.value_eur || 0) / 10000000),
          points: p.overall,
          imageUrl: normalizeImageUrl(detailCache[p.player_id]?.player_face_url),
        } as Player;
      }),
    [searchResults, detailCache]
  );

  const selectedDetail = selectedPlayerId ? detailCache[selectedPlayerId] : undefined;
  const handlePickSuggestion = (s: RedisPlayerSuggestion) => {
    skipNextSuggestFetchRef.current = true;
    setQuery(s.name);
    setDebouncedQuery(s.name);
    setSuggestions([]);
    setSubmittedSearchQ(s.name.trim() || 'a');
    setCurrentPage(1);
    setSelectedPlayerId(s.id);
    void fetchDetail(s.id);
  };

  const fetchDetail = async (playerId: number) => {
    if (detailCache[playerId]) return;
    setDetailLoading(true);
    try {
      const detail = await playerService.getDetailById(playerId);
      setDetailCache(prev => ({ ...prev, [playerId]: detail }));
    } finally {
      setDetailLoading(false);
    }
  };

  const handleAdd = async (player: Player, addAs: Player['position']) => {
    setAddingId(player.id);
    try {
      const currentSquad = squad ?? mapSquadDetails(await squadService.getDetails());
      if (!currentSquad) {
        toast({
          title: 'No squad found',
          description: 'Create a squad first before adding players.',
          variant: 'destructive',
        });
        return;
      }
      const formation = currentSquad.formation || '4-3-3';
      const filled = new Set(currentSquad.players.map(p => p.positionSlot || '').filter(Boolean));
      const totalSlots = getFormationSlots(formation).length;
      if (filled.size >= totalSlots) {
        toast({ title: 'Squad full', description: `Your ${formation} already has 11 players.`, variant: 'destructive' });
        return;
      }

      const shape = getFormationShape(formation);
      const positionLabel =
        addAs === 'GK'
          ? 'GK'
          : addAs === 'DEF'
          ? `DEF (${shape.DEF})`
          : addAs === 'MID'
          ? `MID (${shape.MID})`
          : `FWD (${shape.FWD})`;

      const slot = firstEmptySlotForPosition(formation, filled, addAs);
      if (!slot) {
        toast({
          title: 'Position full',
          description: `No free slot for ${positionLabel} in ${formation}.`,
          variant: 'destructive',
        });
        return;
      }
      await squadService.addPlayer(Number(player.id), slot);
      await refreshSquad();
      setAddAsRoleByPlayerId(prev => {
        const next = { ...prev };
        delete next[player.id];
        return next;
      });
      toast({ title: 'Player added', description: `${player.name} -> ${slot}` });
    } catch (e) {
      toast({
        title: 'Could not add player',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setAddingId(null);
    }
  };

  const spentBudget = squad ? squad.budget - squad.budgetRemaining : 0;
  const budgetRemaining = squad ? squad.budgetRemaining : 0;

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <h1 className="text-3xl text-gold-gradient">Player Search</h1>
        <p className="text-sm text-muted-foreground">
          Name suggestions appear while you type; Elasticsearch results load after you press Enter (or pick a suggestion).
        </p>

        <div className="glass-card rounded-xl p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Budget monitor</p>
          {squadLoading ? (
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading squad budget...
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-muted-foreground">Total</p>
                <p className="font-display text-foreground">£100.0m</p>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-muted-foreground">Used</p>
                <p className="font-display text-foreground">£{spentBudget.toFixed(1)}m</p>
              </div>
              <div className="rounded-md bg-muted/40 p-3">
                <p className="text-muted-foreground">Remaining</p>
                <p className="font-display text-primary">£{budgetRemaining.toFixed(1)}m</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-4 items-start">
          <div className="lg:col-span-2 space-y-4">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => {
                  setQuery(e.target.value);
                }}
                onKeyDown={e => {
                  if (e.key !== 'Enter') return;
                  e.preventDefault();
                  setSubmittedSearchQ(query.trim() || 'a');
                  setCurrentPage(1);
                }}
                placeholder="Search by name, then press Enter…"
                className="pl-10 bg-muted/50 border-border/50"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setDebouncedQuery('');
                    setSuggestions([]);
                    setSubmittedSearchQ(null);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              {suggestions.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-md border border-border/40 bg-background shadow-lg">
                  {suggestions.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => handlePickSuggestion(s)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/40"
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-md border border-border/40 p-3 space-y-2">
                <p className="text-xs text-muted-foreground">Nationality</p>
                <select
                  value={selectedNationality}
                  onChange={e => {
                    setSelectedNationality(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-muted/40 rounded p-2 text-sm"
                >
                  <option value="">All nationalities</option>
                  {COUNTRY_OPTIONS.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-md border border-border/40 p-3 space-y-2">
                <p className="text-xs text-muted-foreground">Position</p>
                <select
                  value={selectedPosition}
                  onChange={e => {
                    setSelectedPosition(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-muted/40 rounded p-2 text-sm"
                >
                  <option value="">All positions</option>
                  {positions.map(pos => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-md border border-border/40 p-3 space-y-2">
                <p className="text-xs text-muted-foreground">Club</p>
                <select
                  value={selectedClub}
                  onChange={e => {
                    setSelectedClub(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full bg-muted/40 rounded p-2 text-sm"
                >
                  <option value="">All clubs</option>
                  {clubOptions.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="rounded-md border border-border/40 p-3 space-y-2">
                <p className="text-xs text-muted-foreground">Rating range</p>
                <div className="flex gap-2">
                  <Input
                    value={minOverall}
                    onChange={e => {
                      setMinOverall(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Min"
                  />
                  <Input
                    value={maxOverall}
                    onChange={e => {
                      setMaxOverall(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Max"
                  />
                </div>
              </div>
            </div>

            {listLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading players...
              </div>
            ) : (
              <div className="space-y-3">
                {players.map((player, i) => (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.4) }}
                    className="glass-card rounded-xl p-4 flex items-center justify-between gap-3"
                  >
                    <button
                      type="button"
                      className="flex items-center gap-4 min-w-0 text-left"
                      onClick={() => {
                        const idNum = Number(player.id);
                        setSelectedPlayerId(idNum);
                        fetchDetail(idNum);
                      }}
                    >
                      <div className="w-12 h-12 shrink-0 rounded-full bg-muted overflow-hidden">
                        {player.imageUrl ? (
                          <img
                            src={player.imageUrl}
                            alt={player.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            onError={e => {
                              e.currentTarget.style.display = 'none';
                              const fallback = e.currentTarget.nextElementSibling as HTMLDivElement | null;
                              if (fallback) fallback.style.display = 'flex';
                            }}
                          />
                        ) : (
                          <></>
                        )}
                        <div
                          className="w-full h-full items-center justify-center font-display text-xs text-muted-foreground hidden"
                          style={{ display: player.imageUrl ? 'none' : 'flex' }}
                        >
                          {player.name
                            .split(' ')
                            .map(n => n[0])
                            .join('')
                            .slice(0, 3)}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{player.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {player.nationality} · {player.team}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">Overall {player.points}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                        {(player.positions && player.positions.length > 0 ? player.positions : [player.position]).map(pos => (
                          <span key={`${player.id}-${pos}`} className={`text-xs px-2 py-0.5 rounded-full font-medium ${getPositionTagClass(pos)}`}>
                            {pos}
                          </span>
                        ))}
                      </div>
                    </button>
                    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-4 text-sm shrink-0">
                      <div className="text-right">
                        <p className="text-muted-foreground">Fantasy price</p>
                        <p className="font-display text-primary">£{player.price.toFixed(1)}m</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label htmlFor={`add-as-${player.id}`} className="text-xs text-muted-foreground whitespace-nowrap">
                          Add as
                        </label>
                        <select
                          id={`add-as-${player.id}`}
                          value={getAddAsRole(player)}
                          onChange={e =>
                            setAddAsRoleByPlayerId(prev => ({
                              ...prev,
                              [player.id]: e.target.value as Player['position'],
                            }))
                          }
                          className="rounded-md border border-border/40 bg-muted/40 px-2 py-1.5 text-xs text-foreground min-w-[4.5rem]"
                        >
                          {positions.map(pos => (
                            <option key={pos} value={pos}>
                              {pos}
                            </option>
                          ))}
                        </select>
                        <Button
                          size="sm"
                          className="btn-gold text-xs px-4"
                          disabled={addingId === player.id}
                          onClick={() => handleAdd(player, getAddAsRole(player))}
                        >
                          {addingId === player.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                ))}

                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    Page {currentPage}/{totalPages} · {totalItems} results
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}>
                      Prev
                    </Button>
                    <Button variant="outline" disabled={currentPage >= totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                      Next
                    </Button>
                  </div>
                </div>

                {players.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <SearchIcon className="h-8 w-8 mx-auto mb-3 opacity-50" />
                    <p>
                      {submittedSearchQ === null
                        ? 'Press Enter to search. Filters apply to the next search.'
                        : 'No players match your filters'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="glass-card rounded-xl p-4 sticky top-20">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Player summary</p>
            {!selectedPlayerId ? (
              <p className="text-sm text-muted-foreground">Select a player to view details.</p>
            ) : detailLoading && !selectedDetail ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading player details...
              </div>
            ) : selectedDetail ? (
              <div className="space-y-3 text-sm">
                {normalizeImageUrl(selectedDetail.player_face_url) ? (
                  <img
                    src={normalizeImageUrl(selectedDetail.player_face_url)}
                    alt={selectedDetail.long_name}
                    className="w-24 h-24 rounded-full object-cover border border-border/40"
                    referrerPolicy="no-referrer"
                    onError={e => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : null}
                <p className="font-medium text-foreground">{selectedDetail.long_name || selectedDetail.short_name}</p>
                <p className="text-muted-foreground">Nationality: {selectedDetail.nationality_name || '—'}</p>
                <p className="text-muted-foreground">Club: {selectedDetail.club_name || '—'}</p>
                <p className="text-muted-foreground">Position: {selectedDetail.player_positions || '—'}</p>
                <p className="text-muted-foreground">Overall: {selectedDetail.overall ?? '—'}</p>
                <p className="text-primary font-display">Fantasy price: £{((selectedDetail.value_eur || 0) / 10000000).toFixed(1)}m</p>
                <div className="pt-2 border-t border-border/30 space-y-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Stats breakdown</p>
                  <div className="max-h-96 overflow-auto space-y-4 pr-1">
                    {detailedStatSections.map(section => (
                      <div key={section.title} className="space-y-2">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{section.title}</p>
                        <div className="grid grid-cols-1 gap-2">
                          {section.metrics.map(([key, label]) => {
                            const rawValue = (selectedDetail as Record<string, unknown>)[key];
                            const value = typeof rawValue === 'number' ? Math.max(0, Math.min(100, rawValue)) : null;
                            return (
                              <div key={key} className="text-xs">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-muted-foreground">{label}</span>
                                  <span className="font-medium text-foreground">{formatStatValue(rawValue)}</span>
                                </div>
                                <div className="mt-1 h-1.5 rounded bg-muted/50 overflow-hidden">
                                  <div className="h-full bg-primary/70" style={{ width: `${value ?? 0}%` }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Position ratings</p>
                      <div className="grid grid-cols-4 gap-2">
                        {positionRatings
                          .filter(key => (selectedDetail as Record<string, unknown>)[key] != null)
                          .map(key => (
                            <div key={key} className="rounded-md bg-muted/30 p-2 text-center">
                              <p className="text-[10px] uppercase text-muted-foreground">{key}</p>
                              <p className="text-xs font-medium text-foreground">{formatStatValue((selectedDetail as Record<string, unknown>)[key])}</p>
                            </div>
                          ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Traits</p>
                      <div className="flex flex-wrap gap-1">
                        {(selectedDetail.player_traits || '')
                          .split(',')
                          .map(t => t.trim())
                          .filter(Boolean)
                          .map(trait => (
                            <span key={trait} className="rounded-full border border-border/40 bg-muted/30 px-2 py-0.5 text-[11px] text-foreground">
                              {trait}
                            </span>
                          ))}
                        {!(selectedDetail.player_traits || '').trim() && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">FIFA metadata</p>
                      {(['fifa_version', 'fifa_update_date', 'work_rate', 'preferred_foot', 'weak_foot', 'skill_moves'] as const).map(key => (
                        <div key={key} className="flex items-start justify-between gap-3 text-xs">
                          <span className="text-muted-foreground">{formatStatKey(key)}</span>
                          <span className="text-foreground text-right break-all">{formatStatValue((selectedDetail as Record<string, unknown>)[key])}</span>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">All returned fields</p>
                      {Object.entries(selectedDetail).map(([key, value]) => (
                        <div key={key} className="flex items-start justify-between gap-3 text-xs">
                          <span className="text-muted-foreground">{formatStatKey(key)}</span>
                          <span className="text-foreground text-right break-all">{formatStatValue(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Could not load summary.</p>
            )}
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default SearchPage;
