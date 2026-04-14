import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Users, DollarSign, Loader2 } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { squadService, mapSquadDetails } from '@/services/squad';
import type { Squad } from '@/services/squad';
import { pitchLayout433 } from '@/lib/squadSlots';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

const SquadPage = () => {
  const { toast } = useToast();
  const [squad, setSquad] = useState<Squad | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('My Squad');
  const [formation, setFormation] = useState('4-3-3');

  const load = async () => {
    setLoading(true);
    try {
      const raw = await squadService.getDetails();
      setSquad(mapSquadDetails(raw));
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
              <Input value={formation} onChange={e => setFormation(e.target.value)} className="bg-muted/50 border-border/50" />
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

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl text-gold-gradient">{squad.name}</h1>
            <p className="text-muted-foreground mt-1">Formation: {squad.formation}</p>
          </div>
          <div className="flex gap-4">
            <div className="glass-card rounded-lg px-4 py-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">{count}/11</span>
            </div>
            <div className="glass-card rounded-lg px-4 py-2 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">£{squad.budgetRemaining.toFixed(1)}m left</span>
            </div>
          </div>
        </div>

        <div className="glass-card rounded-xl overflow-hidden">
          <div
            className="relative w-full"
            style={{ paddingBottom: '65%', background: 'linear-gradient(180deg, hsl(140 40% 18%) 0%, hsl(140 35% 14%) 100%)' }}
          >
            <div className="absolute inset-4 border-2 border-foreground/10 rounded-lg" />
            <div className="absolute left-1/2 top-4 bottom-4 w-px bg-foreground/10" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-2 border-foreground/10" />

            {pitchLayout433.map(({ slot, posLabel, top, left }) => {
              const pl = squad.players.find(p => p.positionSlot === slot);
              const label = pl ? pl.name.split(' ').slice(0, 2).join(' ') : '';
              return (
                <motion.div
                  key={slot}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center max-w-[72px]"
                  style={{ top, left }}
                >
                  <div
                    className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 flex items-center justify-center text-[10px] sm:text-xs font-display text-center leading-tight px-1 ${
                      label
                        ? 'bg-primary/20 border-primary text-foreground'
                        : 'bg-muted/40 border-dashed border-primary/40 text-primary/60'
                    }`}
                  >
                    {label || '+'}
                  </div>
                  <span className="text-[10px] sm:text-xs text-foreground/50 mt-1 font-medium">{posLabel}</span>
                </motion.div>
              );
            })}
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Budget used: £{spent.toFixed(1)}m · Points: {squad.totalPoints}. Go to{' '}
          <Link to="/search" className="text-primary hover:underline">
            Player Search
          </Link>{' '}
          to add players (first free slot is filled automatically).
        </p>
      </motion.div>
    </AppLayout>
  );
};

export default SquadPage;
