import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, Medal, TrendingUp, Loader2, LocateFixed } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { leaderboardService, type LeaderboardEntry, type MyRankResponse } from '@/services/leaderboard';
import { Button } from '@/components/ui/button';

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
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [myRank, setMyRank] = useState<MyRankResponse | null>(null);
  const [myRankLoading, setMyRankLoading] = useState(true);

  const myRowInCurrentPage = useMemo(
    () => (myRank ? items.find(entry => entry.username === myRank.username) ?? null : null),
    [items, myRank]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    leaderboardService
      .getGlobal(page, limit)
      .then(res => {
        if (!cancelled) {
          setItems(res.items);
          setHasNextPage(res.items.length === limit);
        }
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
  }, [page, limit]);

  useEffect(() => {
    let cancelled = false;
    setMyRankLoading(true);
    leaderboardService
      .getAroundUser()
      .then(res => {
        if (!cancelled) setMyRank(res);
      })
      .catch(() => {
        if (!cancelled) setMyRank(null);
      })
      .finally(() => {
        if (!cancelled) setMyRankLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const jumpToMyRankPage = () => {
    if (!myRank || myRank.rank <= 0) return;
    const targetPage = Math.max(1, Math.ceil(myRank.rank / limit));
    setPage(targetPage);
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl text-gold-gradient">Leaderboard</h1>
            <p className="text-muted-foreground mt-1">Global rankings</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-border/50"
              onClick={jumpToMyRankPage}
              disabled={myRankLoading || !myRank || myRank.rank <= 0}
            >
              <LocateFixed className="h-4 w-4 mr-1" />
              Find my rank
            </Button>
            <TrendingUp className="h-6 w-6 text-primary" />
          </div>
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
                } ${
                  myRank && entry.username === myRank.username ? 'bg-primary/15 ring-1 ring-primary/40' : ''
                } ${i < items.length - 1 ? 'border-b border-border/10' : ''}`}
              >
                <div className="col-span-2 sm:col-span-1 flex items-center">{rankIcon(entry.rank)}</div>
                <div className="col-span-7 sm:col-span-8 font-medium text-foreground">{entry.username}</div>
                <div className="col-span-3 text-right font-display text-primary">{entry.totalPoints}</div>
              </motion.div>
            ))}
        </div>

        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            className="border-border/50"
            disabled={page <= 1 || loading}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <p className="text-sm text-muted-foreground">Page {page}</p>
          <Button
            type="button"
            variant="outline"
            className="border-border/50"
            disabled={!hasNextPage || loading}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>

        {myRank && (
          <div className="glass-card rounded-xl p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Your position</p>
            <p className="text-sm text-foreground mt-1">
              Rank <span className="font-display text-primary">#{myRank.rank || '—'}</span> ·{' '}
              <span className="font-medium">{myRank.username}</span> · Points{' '}
              <span className="font-display text-primary">{myRank.score}</span>
            </p>
            {myRowInCurrentPage ? (
              <p className="text-xs text-emerald-400 mt-1">Highlighted in current page.</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">Not in current page. Use "Find my rank".</p>
            )}
          </div>
        )}
      </motion.div>
    </AppLayout>
  );
};

export default LeaderboardPage;
