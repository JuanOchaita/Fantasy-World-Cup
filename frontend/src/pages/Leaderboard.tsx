import { motion } from 'framer-motion';
import { Trophy, Medal, TrendingUp } from 'lucide-react';
import AppLayout from '@/components/AppLayout';

const mockLeaderboard = [
  { rank: 1, username: 'GoalMachine', squadName: 'Unstoppables FC', totalPoints: 456, gameweekPoints: 87 },
  { rank: 2, username: 'TacticalGenius', squadName: 'Formation Masters', totalPoints: 441, gameweekPoints: 72 },
  { rank: 3, username: 'TransferKing', squadName: 'Market Movers', totalPoints: 438, gameweekPoints: 65 },
  { rank: 4, username: 'SetPieceExpert', squadName: 'Corner Takers', totalPoints: 425, gameweekPoints: 58 },
  { rank: 5, username: 'CleanSheetFC', squadName: 'The Wall', totalPoints: 419, gameweekPoints: 54 },
  { rank: 6, username: 'YoungGunner', squadName: 'Rising Stars', totalPoints: 412, gameweekPoints: 61 },
  { rank: 7, username: 'MidfieldMaestro', squadName: 'Tiki-Taka XI', totalPoints: 405, gameweekPoints: 49 },
  { rank: 8, username: 'CounterAttack', squadName: 'Speed Demons', totalPoints: 398, gameweekPoints: 52 },
];

const rankIcon = (rank: number) => {
  if (rank === 1) return <Trophy className="h-5 w-5 text-primary" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-gold-light" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-amber-600" />;
  return <span className="text-sm font-display text-muted-foreground w-5 text-center">{rank}</span>;
};

const LeaderboardPage = () => {
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
            <div className="col-span-1">#</div>
            <div className="col-span-5">Manager</div>
            <div className="col-span-3 hidden sm:block">Squad</div>
            <div className="col-span-2 text-right">GW</div>
            <div className="col-span-1 text-right">Total</div>
          </div>

          {/* Rows */}
          {mockLeaderboard.map((entry, i) => (
            <motion.div
              key={entry.rank}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className={`grid grid-cols-12 gap-2 px-4 py-3 items-center text-sm ${
                i < 3 ? 'bg-primary/5' : ''
              } ${i < mockLeaderboard.length - 1 ? 'border-b border-border/10' : ''}`}
            >
              <div className="col-span-1 flex items-center">{rankIcon(entry.rank)}</div>
              <div className="col-span-5 font-medium text-foreground">{entry.username}</div>
              <div className="col-span-3 hidden sm:block text-muted-foreground text-xs">{entry.squadName}</div>
              <div className="col-span-2 text-right text-muted-foreground">{entry.gameweekPoints}</div>
              <div className="col-span-1 text-right font-display text-primary">{entry.totalPoints}</div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default LeaderboardPage;
