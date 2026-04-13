import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search as SearchIcon, Filter, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import AppLayout from '@/components/AppLayout';

const positions = ['All', 'GK', 'DEF', 'MID', 'FWD'] as const;

const positionColors: Record<string, string> = {
  GK: 'bg-amber-500/20 text-amber-400',
  DEF: 'bg-blue-500/20 text-blue-400',
  MID: 'bg-emerald-500/20 text-emerald-400',
  FWD: 'bg-red-500/20 text-red-400',
};

// Mock data for UI demonstration
const mockPlayers = [
  { id: '1', name: 'Kylian Mbappé', position: 'FWD', team: 'France', price: 12.5, points: 142 },
  { id: '2', name: 'Jude Bellingham', position: 'MID', team: 'England', price: 11.0, points: 128 },
  { id: '3', name: 'Vinícius Jr.', position: 'FWD', team: 'Brazil', price: 11.5, points: 135 },
  { id: '4', name: 'Virgil van Dijk', position: 'DEF', team: 'Netherlands', price: 7.0, points: 98 },
  { id: '5', name: 'Thibaut Courtois', position: 'GK', team: 'Belgium', price: 6.0, points: 89 },
  { id: '6', name: 'Rodri', position: 'MID', team: 'Spain', price: 9.5, points: 118 },
];

const SearchPage = () => {
  const [query, setQuery] = useState('');
  const [activePosition, setActivePosition] = useState<string>('All');

  const filtered = mockPlayers.filter(p =>
    (activePosition === 'All' || p.position === activePosition) &&
    (!query || p.name.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <h1 className="text-3xl text-gold-gradient">Player Search</h1>

        {/* Search bar */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search players..."
              className="pl-10 bg-muted/50 border-border/50"
            />
            {query && (
              <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Position filters */}
        <div className="flex gap-2 flex-wrap">
          {positions.map(pos => (
            <button
              key={pos}
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

        {/* Results */}
        <div className="space-y-3">
          {filtered.map((player, i) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center font-display text-sm text-muted-foreground">
                  {player.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <p className="font-medium text-foreground">{player.name}</p>
                  <p className="text-xs text-muted-foreground">{player.team}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${positionColors[player.position]}`}>
                  {player.position}
                </span>
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="text-right hidden sm:block">
                  <p className="text-muted-foreground">Points</p>
                  <p className="font-display text-foreground">{player.points}</p>
                </div>
                <div className="text-right">
                  <p className="text-muted-foreground">Price</p>
                  <p className="font-display text-primary">£{player.price}m</p>
                </div>
                <Button size="sm" className="btn-gold text-xs px-4">Add</Button>
              </div>
            </motion.div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <SearchIcon className="h-8 w-8 mx-auto mb-3 opacity-50" />
              <p>No players found</p>
            </div>
          )}
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default SearchPage;
