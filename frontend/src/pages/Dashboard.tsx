import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Calendar, Wallet, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';
import { squadService, mapSquadDetails } from '@/services/squad';
import { leaderboardService } from '@/services/leaderboard';

const quickActions = [
  { label: 'Build Your Squad', to: '/squad', desc: 'Pick your starting XI' },
  { label: 'Search Players', to: '/search', desc: 'Find the best performers' },
  { label: 'View Leaderboard', to: '/leaderboard', desc: 'Check your ranking' },
];

const Dashboard = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [globalRank, setGlobalRank] = useState<number | null>(null);
  const [squadPoints, setSquadPoints] = useState<number>(0);
  const [gameWins, setGameWins] = useState<number>(0);
  const [budgetLeft, setBudgetLeft] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      setLoading(true);
      try {
        const [squadRaw, myRank] = await Promise.all([squadService.getDetails(), leaderboardService.getAroundUser()]);
        if (cancelled) return;
        const squad = mapSquadDetails(squadRaw);
        setGlobalRank(myRank.rank > 0 ? myRank.rank : null);
        // Keep dashboard points consistent with leaderboard source of truth.
        setSquadPoints(Number.isFinite(myRank.score) ? myRank.score : squad.totalPoints);
        setGameWins(myRank.game_wins ?? 0);
        setBudgetLeft(squad.budgetRemaining);
      } catch {
        if (!cancelled) {
          setGlobalRank(null);
          setSquadPoints(0);
          setGameWins(0);
          setBudgetLeft(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(
    () => [
      { label: 'Global Rank', value: globalRank ? `#${globalRank}` : '—', icon: TrendingUp, color: 'text-primary' },
      { label: 'Squad Points', value: String(squadPoints), icon: Trophy, color: 'text-gold-light' },
      { label: 'Game Wins', value: String(gameWins), icon: Calendar, color: 'text-primary' },
      { label: 'Budget Left', value: `£${budgetLeft.toFixed(1)}m`, icon: Wallet, color: 'text-gold-light' },
    ],
    [globalRank, squadPoints, gameWins, budgetLeft]
  );

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
        <div>
          <h1 className="text-3xl text-gold-gradient">Welcome back{user ? `, ${user.username}` : ''}</h1>
          <p className="text-muted-foreground mt-1">Your fantasy overview</p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card rounded-xl p-5"
            >
              <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
              <p className="text-2xl font-display text-foreground">
                {loading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : stat.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="text-lg text-foreground font-display mb-4">Quick Actions</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {quickActions.map((action, i) => (
              <motion.div
                key={action.to}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
              >
                <Link
                  to={action.to}
                  className="glass-card rounded-xl p-5 block hover:border-primary/30 transition-colors group"
                >
                  <p className="font-display text-foreground group-hover:text-primary transition-colors">
                    {action.label}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">{action.desc}</p>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default Dashboard;
