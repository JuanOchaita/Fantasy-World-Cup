import { motion } from 'framer-motion';
import { Users, DollarSign } from 'lucide-react';
import AppLayout from '@/components/AppLayout';

const formation = '4-3-3';
const budget = 100;
const spent = 0;

// Empty squad slots
const slots = [
  { pos: 'GK', count: 1, top: '82%', positions: [{ left: '50%' }] },
  { pos: 'DEF', count: 4, top: '62%', positions: [{ left: '15%' }, { left: '38%' }, { left: '62%' }, { left: '85%' }] },
  { pos: 'MID', count: 3, top: '38%', positions: [{ left: '25%' }, { left: '50%' }, { left: '75%' }] },
  { pos: 'FWD', count: 3, top: '15%', positions: [{ left: '25%' }, { left: '50%' }, { left: '75%' }] },
];

const SquadPage = () => {
  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl text-gold-gradient">Squad Builder</h1>
            <p className="text-muted-foreground mt-1">Formation: {formation}</p>
          </div>
          <div className="flex gap-4">
            <div className="glass-card rounded-lg px-4 py-2 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">0/11</span>
            </div>
            <div className="glass-card rounded-lg px-4 py-2 flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">£{budget - spent}m</span>
            </div>
          </div>
        </div>

        {/* Pitch */}
        <div className="glass-card rounded-xl overflow-hidden">
          <div className="relative w-full" style={{ paddingBottom: '65%', background: 'linear-gradient(180deg, hsl(140 40% 18%) 0%, hsl(140 35% 14%) 100%)' }}>
            {/* Pitch markings */}
            <div className="absolute inset-4 border-2 border-foreground/10 rounded-lg" />
            <div className="absolute left-1/2 top-4 bottom-4 w-px bg-foreground/10" />
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-2 border-foreground/10" />

            {/* Player slots */}
            {slots.map(line =>
              line.positions.map((p, i) => (
                <motion.div
                  key={`${line.pos}-${i}`}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                  style={{ top: line.top, left: p.left }}
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-muted/40 border-2 border-dashed border-primary/40 flex items-center justify-center text-xs font-display text-primary/60 cursor-pointer hover:border-primary hover:bg-primary/10 transition-colors">
                    +
                  </div>
                  <span className="text-[10px] sm:text-xs text-foreground/50 mt-1 font-medium">{line.pos}</span>
                </motion.div>
              ))
            )}
          </div>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Click a slot or go to <a href="/search" className="text-primary hover:underline">Player Search</a> to add players.
        </p>
      </motion.div>
    </AppLayout>
  );
};

export default SquadPage;
