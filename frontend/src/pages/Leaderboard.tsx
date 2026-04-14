import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, TrendingUp, Loader2 } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { leaderboardService, type LeaderboardEntry } from '@/services/leaderboard';

const rankIcon = (rank: number) => {
  if (rank === 1) return <Trophy className="h-5 w-5 text-primary" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gold-light" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
  return <span className="text-sm font-display text-muted-foreground w-5 text-center">{rank}</span>;
};

const LeaderboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    leaderboardService
      .getGlobal(1, 50)
      .then(res => {
        if (!cancelled) setItems(res.items);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load leaderboard');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl text-gold-gradient">Leaderboard</h1>
            <p className="text-muted-foreground mt-1">Global rankings</p>
          </div>
          <TrendingUp className="h-6 w-6 text-primary" />
        </div>

        <div className="glass-card rounded-xl overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-medium text-muted-foreground border-b border-border/30 uppercase tracking-wider">
            <div className="col-span-2 sm:col-span-1">#</div>
            <div className="col-span-7 sm:col-span-8">Manager</div>
            <div className="col-span-3 text-right">Total</div>
          </div>

          {loading && (
            <div className="py-10 flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading leaderboard...
            </div>
          )}

          {!loading && error && <div className="py-10 text-center text-destructive text-sm">{error}</div>}

          {!loading && !error && items.length === 0 && (
            <div className="py-10 text-center text-muted-foreground text-sm">No ranking data available yet.</div>
          )}

          {!loading &&
            !error &&
            items.map((entry, i) => (
              <motion.div
                key={`${entry.rank}-${entry.username}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm ${
                  i < 3 ? 'bg-primary/5' : ''
                } ${i < items.length - 1 ? 'border-b border-border/10' : ''}`}
              >
                <div className="col-span-2 sm:col-span-1 flex items-center">{rankIcon(entry.rank)}</div>
                <div className="col-span-7 sm:col-span-8 font-medium text-foreground">{entry.username}</div>
                <div className="col-span-3 text-right font-display text-primary">{entry.totalPoints}</div>
              </motion.div>
            ))}
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default LeaderboardPage;
