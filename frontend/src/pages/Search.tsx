import { useState, useEffect, useMemo, useCallback } from 'react';
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

const positionColors: Record<string, string> = {
  GK: 'bg-amber-500/20 text-amber-400',
  DEF: 'bg-blue-500/20 text-blue-400',
  MID: 'bg-emerald-500/20 text-emerald-400',
  FWD: 'bg-red-500/20 text-red-400',
};

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
    let cancelled = false;
    setListLoading(true);
    playerService
      .searchAdvanced({
        q: debouncedQuery || 'a',
        page: currentPage,
        size: 50,
        nationality: selectedNationality || undefined,
        position: selectedPosition || undefined,
        club: selectedClub || undefined,
        min_overall: Number(minOverall),
        max_overall: Number(maxOverall),
      })
      .then(res => {
        if (cancelled) return;
        const filtered = res.results.filter(p => {
          const byNationality = selectedNationality
            ? p.nationality_name?.toLowerCase() === selectedNationality.toLowerCase()
            : true;
          const byPosition = selectedPosition
            ? (p.player_positions || '').toUpperCase().includes(selectedPosition)
            : true;
          const byClub = selectedClub ? selectedClub === (p.club_name || '') : true;
          const byOverall = p.overall >= Number(minOverall) && p.overall <= Number(maxOverall);
          return byNationality && byPosition && byClub && byOverall;
        });
        setSearchResults(filtered);
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
  }, [debouncedQuery, currentPage, selectedNationality, selectedPosition, selectedClub, minOverall, maxOverall, toast]);

  const players = useMemo(
    () =>
      searchResults.map(p => {
        const pos = (p.player_positions || '').toUpperCase();
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
    setQuery(s.name);
    setDebouncedQuery(s.name);
    setSuggestions([]);
    setSelectedPlayerId(s.id);
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

  const handleAdd = async (player: Player) => {
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
        player.position === 'GK'
          ? 'GK'
          : player.position === 'DEF'
          ? `DEF (${shape.DEF})`
          : player.position === 'MID'
          ? `MID (${shape.MID})`
          : `FWD (${shape.FWD})`;

      const slot = firstEmptySlotForPosition(formation, filled, player.position);
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
          Search uses live services (name suggestions + advanced filters + paginated results).
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
                  setCurrentPage(1);
                }}
                placeholder="Search by name..."
                className="pl-10 bg-muted/50 border-border/50"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    setDebouncedQuery('');
                    setSuggestions([]);
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
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${positionColors[player.position]}`}>
                        {player.position}
                      </span>
                    </button>
                    <div className="flex items-center gap-4 sm:gap-6 text-sm shrink-0">
                      <div className="text-right">
                        <p className="text-muted-foreground">Fantasy price</p>
                        <p className="font-display text-primary">£{player.price.toFixed(1)}m</p>
                      </div>
                      <Button size="sm" className="btn-gold text-xs px-4" disabled={addingId === player.id} onClick={() => handleAdd(player)}>
                        {addingId === player.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
                      </Button>
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
                    <p>No players match your filters</p>
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
