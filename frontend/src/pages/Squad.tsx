import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Users, DollarSign, Loader2, X } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { squadService, mapSquadDetails } from '@/services/squad';
import type { Squad } from '@/services/squad';
import { leaderboardService } from '@/services/leaderboard';
import { playerService } from '@/services/players';
import { FORMATION_OPTIONS, getFormationShape, getPitchLayout } from '@/lib/squadSlots';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

const SquadPage = () => {
  const { toast } = useToast();
  const [squad, setSquad] = useState<Squad | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [removingPlayerId, setRemovingPlayerId] = useState<string | null>(null);
  const [newName, setNewName] = useState('My Squad');
  const [formation, setFormation] = useState('4-3-3');
  const [accumulatedPoints, setAccumulatedPoints] = useState(0);
  const [playerFaceById, setPlayerFaceById] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [raw, rankInfo] = await Promise.all([
        squadService.getDetails(),
        leaderboardService.getAroundUser().catch(() => null),
      ]);
      const mapped = mapSquadDetails(raw);
      setSquad(mapped);
      setNewName(mapped.name);
      setFormation(mapped.formation);
      setAccumulatedPoints(rankInfo && Number.isFinite(rankInfo.score) ? rankInfo.score : mapped.totalPoints);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load squad';
      const m = msg.toLowerCase();
      if (m.includes('404') || m.includes('escuadra no encontrada') || m.includes('not found')) {
        setSquad(null);
      } else {
        toast({ title: 'Squad', description: msg, variant: 'destructive' });
        setSquad(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  useEffect(() => {
    if (!squad?.players?.length) return;
    let cancelled = false;
    const missingIds = squad.players.map(p => p.id).filter(id => id && !playerFaceById[id]);
    if (!missingIds.length) return;

    Promise.all(
      missingIds.map(async id => {
        try {
          const detail = await playerService.getDetailById(Number(id));
          return { id, url: detail.player_face_url?.trim() || '' };
        } catch {
          return { id, url: '' };
        }
      })
    ).then(entries => {
      if (cancelled) return;
      setPlayerFaceById(prev => {
        const next = { ...prev };
        for (const entry of entries) {
          if (entry.url) next[entry.id] = entry.url;
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [squad, playerFaceById]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await squadService.initSquad({ name: newName.trim() || 'My Squad', formation });
      await load();
      toast({ title: 'Squad ready', description: 'Your squad was created.' });
    } catch (e) {
      toast({
        title: 'Could not create squad',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!squad) return;
    const trimmedName = newName.trim();
    if (!trimmedName) {
      toast({ title: 'Invalid name', description: 'Please enter a squad name.', variant: 'destructive' });
      return;
    }
    setSavingProfile(true);
    try {
      if (trimmedName !== squad.name) {
        try {
          await squadService.updateProfile({ name: trimmedName, formation: squad.formation });
        } catch (error) {
          if (!(error instanceof Error) || !error.message.includes('404')) throw error;
          toast({
            title: 'Name update unavailable',
            description: 'The current backend route does not support squad name updates.',
            variant: 'destructive',
          });
        }
      }

      if (formation !== squad.formation) {
        const currentShape = getFormationShape(squad.formation);
        const nextShape = getFormationShape(formation);

        const overflowPlayers = squad.players.filter(player => {
          const slot = player.positionSlot || '';
          if (slot.startsWith('D')) return Number(slot.slice(1)) > nextShape.DEF && nextShape.DEF < currentShape.DEF;
          if (slot.startsWith('M')) return Number(slot.slice(1)) > nextShape.MID && nextShape.MID < currentShape.MID;
          if (slot.startsWith('F')) return Number(slot.slice(1)) > nextShape.FWD && nextShape.FWD < currentShape.FWD;
          return false;
        });

        if (overflowPlayers.length > 0) {
          for (const player of overflowPlayers) {
            await squadService.removePlayer(Number(player.id));
          }
        }

        await squadService.changeFormation(formation);
      }

      await load();
      setEditing(false);
      toast({ title: 'Squad updated', description: 'Formation and profile were updated.' });
    } catch (e) {
      if (e instanceof Error && e.message.includes('404')) {
        toast({
          title: 'Cambio de formacion no disponible',
          description: 'El endpoint PATCH /squad/formation no esta disponible en tu backend actual.',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Could not update squad',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRemovePlayer = async (playerId: string, playerName: string) => {
    setRemovingPlayerId(playerId);
    try {
      await squadService.removePlayer(Number(playerId));
      await load();
      toast({ title: 'Player removed', description: `${playerName} was removed from your squad.` });
    } catch (e) {
      toast({
        title: 'Could not remove player',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setRemovingPlayerId(null);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading squad…
        </div>
      </AppLayout>
    );
  }

  if (!squad) {
    return (
      <AppLayout>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md mx-auto space-y-6">
          <h1 className="text-3xl text-gold-gradient">Create your squad</h1>
          <p className="text-muted-foreground text-sm">You need a squad before you can add players.</p>
          <div className="glass-card rounded-xl p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Squad name</label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} className="bg-muted/50 border-border/50" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Formation</label>
              <div className="grid grid-cols-3 gap-2">
                {FORMATION_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setFormation(opt)}
                    className={`rounded-md px-3 py-2 text-sm border transition-colors ${
                      formation === opt
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/40 text-muted-foreground border-border/50 hover:text-foreground'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <Button onClick={handleCreate} disabled={creating} className="w-full btn-gold">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create squad'}
            </Button>
          </div>
        </motion.div>
      </AppLayout>
    );
  }

  const count = squad.players.length;
  const spent = squad.budget - squad.budgetRemaining;
  const shape = getFormationShape(squad.formation);
  const pitchLayout = getPitchLayout(squad.formation);
  const horizontalCenterOffset = '3.5%';
  const slotRows = pitchLayout.map(({ slot, posLabel }) => ({
    slot,
    posLabel,
    player: squad.players.find(p => p.positionSlot === slot) ?? null,
  }));

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl text-gold-gradient">{squad.name}</h1>
            <p className="text-muted-foreground mt-1">Formation: {squad.formation}</p>
            <p className="text-xs text-muted-foreground mt-1">
              DEF {shape.DEF} · MID {shape.MID} · FWD {shape.FWD}
            </p>
          </div>
          <div className="flex gap-4 items-center">
            <Button
              type="button"
              variant="outline"
              className="border-border/50"
              onClick={() => {
                setNewName(squad.name);
                setFormation(squad.formation);
                setEditing(v => !v);
              }}
            >
              {editing ? 'Cancel edit' : 'Edit squad'}
            </Button>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 border border-primary/20 bg-primary/5">
          <p className="text-sm text-foreground">
            To add players, go to the{' '}
            <Link to="/search" className="text-primary hover:underline font-medium">
              Players
            </Link>{' '}
            page. This Squad page is for editing squad name, changing formation, and removing players.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="glass-card rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Formation</p>
            <p className="text-sm font-medium text-foreground">{squad.formation}</p>
          </div>
          <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Slots filled</p>
              <p className="text-sm font-medium text-foreground">{count}/11</p>
            </div>
          </div>
          <div className="glass-card rounded-lg px-4 py-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-primary" />
            <div>
              <p className="text-xs text-muted-foreground">Total squad cost</p>
              <p className="text-sm font-medium text-foreground">£{spent.toFixed(1)}m</p>
            </div>
          </div>
          <div className="glass-card rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Remaining budget</p>
            <p className="text-sm font-medium text-foreground">£{squad.budgetRemaining.toFixed(1)}m</p>
          </div>
          <div className="glass-card rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Accumulated points</p>
            <p className="text-sm font-medium text-foreground">{accumulatedPoints}</p>
          </div>
        </div>

        {editing && (
          <div className="glass-card rounded-xl p-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Squad name</label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} className="bg-muted/50 border-border/50" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Formation</label>
              <div className="grid grid-cols-3 gap-2">
                {FORMATION_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setFormation(opt)}
                    className={`rounded-md px-3 py-2 text-sm border transition-colors ${
                      formation === opt
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/40 text-muted-foreground border-border/50 hover:text-foreground'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
            <Button type="button" onClick={handleSaveProfile} disabled={savingProfile} className="btn-gold">
              {savingProfile ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save changes'}
            </Button>
          </div>
        )}

        <div className="glass-card rounded-xl overflow-hidden max-w-[788px] mx-auto">
          <div
            className="relative w-full"
            style={{ paddingBottom: '95%', background: 'linear-gradient(180deg, hsl(140 40% 18%) 0%, hsl(140 35% 14%) 100%)' }}
          >
            <div className="absolute inset-[8%] border-2 border-foreground/10 rounded-2xl" />
            <div className="absolute left-[8%] right-[8%] top-1/2 h-px bg-foreground/10" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-2 border-foreground/10" />

            {pitchLayout.map(({ slot, posLabel, top, left }) => {
              const pl = squad.players.find(p => p.positionSlot === slot);
              const initials = pl
                ? (() => {
                    const parts = pl.name.trim().split(/\s+/).filter(Boolean);
                    if (parts.length >= 2) return `${parts[0][0]} ${parts[1][0]}`;
                    if (parts.length === 1) return parts[0][0];
                    return '';
                  })()
                : '';
              const faceUrl = pl ? playerFaceById[pl.id] : '';
              return (
                <motion.div
                  key={slot}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center max-w-[96px]"
                  style={{ top, left: `calc(${left} - ${horizontalCenterOffset})` }}
                >
                  <div className="relative">
                    <div
                      className={`w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 flex items-center justify-center text-[10px] sm:text-xs font-display text-center leading-tight px-1 ${
                        pl
                          ? 'bg-primary/20 border-primary text-foreground'
                          : 'bg-muted/40 border-dashed border-primary/40 text-primary/60'
                      }`}
                    >
                      {pl && faceUrl ? (
                        <img
                          src={faceUrl}
                          alt={pl.name}
                          className="w-full h-full rounded-full object-cover"
                          referrerPolicy="no-referrer"
                          onError={e => {
                            e.currentTarget.style.display = 'none';
                            const fallback = e.currentTarget.nextElementSibling as HTMLSpanElement | null;
                            if (fallback) fallback.style.display = 'inline';
                          }}
                        />
                      ) : null}
                      <span style={{ display: pl && faceUrl ? 'none' : 'inline' }}>{initials}</span>
                    </div>
                    {pl && (
                      <button
                        type="button"
                        onClick={() => handleRemovePlayer(pl.id, pl.name)}
                        disabled={removingPlayerId === pl.id}
                        className="absolute -right-1 -top-1 rounded-full p-1 bg-background/90 border border-border/60 hover:bg-background"
                        aria-label={`Remove ${pl.name}`}
                      >
                        {removingPlayerId === pl.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <X className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>
                  <span className="text-[10px] sm:text-xs text-foreground/50 mt-1 font-medium">{slot}</span>
                  <span className="text-[10px] sm:text-xs text-foreground/50 mt-0.5 font-medium">{posLabel}</span>
                </motion.div>
              );
            })}
          </div>
        </div>

        <div className="glass-card rounded-xl p-4">
          <h2 className="text-sm font-medium text-foreground mb-3">All 11 slots</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {slotRows.map(({ slot, posLabel, player }) => (
              <div key={slot} className="rounded-md border border-border/40 px-3 py-2 bg-muted/20">
                <p className="text-xs text-muted-foreground">
                  {slot} · {posLabel}
                </p>
                <p className="text-sm text-foreground truncate">{player ? player.name : 'Empty slot'}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Budget used: £{spent.toFixed(1)}m · Points: {accumulatedPoints}. Go to{' '}
          <Link to="/search" className="text-primary hover:underline">
            Player Search
          </Link>{' '}
          to add players according to your formation slots.
        </p>
      </motion.div>
    </AppLayout>
  );
};

export default SquadPage;
