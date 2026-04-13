import { motion } from 'framer-motion';
import { Trophy, Users, TrendingUp, Calendar } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { Link } from 'react-router-dom';
import AppLayout from '@/components/AppLayout';

const stats = [
  { label: 'Squad Points', value: '—', icon: Trophy, color: 'text-primary' },
  { label: 'Players', value: '0/11', icon: Users, color: 'text-gold-light' },
  { label: 'Global Rank', value: '—', icon: TrendingUp, color: 'text-primary' },
  { label: 'Matchday', value: '1', icon: Calendar, color: 'text-gold-light' },
];

const quickActions = [
  { label: 'Build Your Squad', to: '/squad', desc: 'Pick your starting XI' },
  { label: 'Search Players', to: '/search', desc: 'Find the best performers' },
  { label: 'View Leaderboard', to: '/leaderboard', desc: 'Check your ranking' },
];

const Dashboard = () => {
  const { user } = useAuthStore();

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
              <p className="text-2xl font-display text-foreground">{stat.value}</p>
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
