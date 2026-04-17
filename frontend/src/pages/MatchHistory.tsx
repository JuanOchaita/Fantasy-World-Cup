import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Info, Loader2 } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { matchService, type MatchHistoryItem } from '@/services/matches';

const MatchHistoryPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [matches, setMatches] = useState<MatchHistoryItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    matchService
      .getHistory()
      .then(res => {
        if (cancelled) return;
        setTotalPoints(res.total_accumulated_points ?? 0);
        setMatches(res.matches ?? []);
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load match history');
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
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl text-gold-gradient">Match History</h1>
            <p className="text-muted-foreground mt-1">All processed matches and your scoring breakdown.</p>
          </div>
          <div className="glass-card rounded-lg px-4 py-3">
            <p className="text-xs text-muted-foreground">Total accumulated points</p>
            <p className="text-lg font-display text-primary">{totalPoints}</p>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-primary mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">How scoring works</p>
              <p>Win: 3 points per player from winning team. Draw: 1 point per player. Loss: 0 points.</p>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading match history...
          </div>
        )}

        {!loading && error && <div className="text-sm text-destructive">{error}</div>}

        {!loading && !error && matches.length === 0 && (
          <div className="glass-card rounded-xl p-6 text-sm text-muted-foreground">No scoring history yet.</div>
        )}

        {!loading &&
          !error &&
          matches.map(match => (
            <div key={match.match_id} className="glass-card rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">
                    {match.team_a} {match.score_a} - {match.score_b} {match.team_b}
                  </p>
                  <p className="text-xs text-muted-foreground">{match.scored_at}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Points from this match</p>
                  <p className="font-display text-primary">{match.points_earned}</p>
                </div>
              </div>

              <div className="rounded-md border border-border/40">
                <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border/30 uppercase">
                  Player contribution breakdown
                </div>
                {match.contributions.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-muted-foreground">No player contributed points in this match.</p>
                ) : (
                  <div className="divide-y divide-border/20">
                    {match.contributions.map(contrib => (
                      <div key={`${match.match_id}-${contrib.player_id}`} className="px-3 py-2 flex items-center justify-between">
                        <span className="text-sm text-foreground">{contrib.player_name}</span>
                        <span className="text-sm font-medium text-primary">+{contrib.points_earned}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
      </motion.div>
    </AppLayout>
  );
};

export default MatchHistoryPage;
