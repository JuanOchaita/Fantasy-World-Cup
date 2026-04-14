import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search as SearchIcon, X, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import AppLayout from '@/components/AppLayout';
import { playerService, mapPlayerApiRow, type Player } from '@/services/players';
import { mapSquadDetails, squadService, type Squad } from '@/services/squad';
import { firstEmptySlotForPosition, getFormationShape, getFormationSlots } from '@/lib/squadSlots';
import { useToast } from '@/hooks/use-toast';

const positions = ['All', 'GK', 'DEF', 'MID', 'FWD'] as const;

const positionColors: Record<string, string> = {
  GK: 'bg-amber-500/20 text-amber-400',
  DEF: 'bg-blue-500/20 text-blue-400',
  MID: 'bg-emerald-500/20 text-emerald-400',
  FWD: 'bg-red-500/20 text-red-400',
};

const SearchPage = () => {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [activePosition, setActivePosition] = useState<string>('All');
  const [players, setPlayers] = useState<Player[]>([]);
  const [listLoading, setListLoading] = useState(true);
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
    let cancelled = false;
    setListLoading(true);
    playerService
      .list(200, 0)
      .then(res => {
        if (!cancelled) setPlayers(res.results.map(mapPlayerApiRow));
      })
      .catch(e => {
        if (!cancelled) {
          toast({
            title: 'Players',
            description: e instanceof Error ? e.message : 'Could not load players',
            variant: 'destructive',
          });
          setPlayers([]);
        }
      })
      .finally(() => {
        if (!cancelled) setListLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    refreshSquad();
  }, [refreshSquad]);

  const filtered = useMemo(
    () =>
      players.filter(
        p =>
          (activePosition === 'All' || p.position === activePosition) &&
          (!query || p.name.toLowerCase().includes(query.toLowerCase()))
      ),
    [players, activePosition, query]
  );

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
      toast({ title: 'Player added', description: `${player.name} → ${slot}` });
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
          Browsing the player pool (client-side filters). Server-side name search is not connected yet.
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

        <div className="flex gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Filter by name…"
              className="pl-10 bg-muted/50 border-border/50"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {positions.map(pos => (
            <button
              key={pos}
              type="button"
              onClick={() => setActivePosition(pos)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activePosition === pos
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted/50 text-muted-foreground hover:text-foreground'
              }`}
            >
              {pos}
            </button>
          ))}
        </div>

        {listLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading players…
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((player, i) => (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.4) }}
                className="glass-card rounded-xl p-4 flex items-center justify-between"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-muted flex items-center justify-center font-display text-sm text-muted-foreground">
                    {player.name
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .slice(0, 3)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{player.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{player.team}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${positionColors[player.position]}`}>
                    {player.position}
                  </span>
                </div>
                <div className="flex items-center gap-4 sm:gap-6 text-sm shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-muted-foreground">Points</p>
                    <p className="font-display text-foreground">{player.points || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-muted-foreground">Price</p>
                    <p className="font-display text-primary">£{player.price.toFixed(1)}m</p>
                  </div>
                  <Button
                    size="sm"
                    className="btn-gold text-xs px-4"
                    disabled={addingId === player.id}
                    onClick={() => handleAdd(player)}
                  >
                    {addingId === player.id ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add'}
                  </Button>
                </div>
              </motion.div>
            ))}

            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <SearchIcon className="h-8 w-8 mx-auto mb-3 opacity-50" />
                <p>No players match your filters</p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    </AppLayout>
  );
};

export default SearchPage;
