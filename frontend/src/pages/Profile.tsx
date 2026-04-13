import { motion } from 'framer-motion';
import { User, Mail, LogOut, Shield } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import AppLayout from '@/components/AppLayout';

const ProfilePage = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-lg mx-auto space-y-6">
        <h1 className="text-3xl text-gold-gradient">Profile</h1>

        <div className="glass-card rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <p className="font-display text-xl text-foreground">{user?.username || 'Manager'}</p>
              <p className="text-sm text-muted-foreground">{user?.email || 'email@example.com'}</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Username</p>
                <p className="text-sm text-foreground">{user?.username || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm text-foreground">{user?.email || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Account ID</p>
                <p className="text-sm text-foreground font-mono text-xs">{user?.id || '—'}</p>
              </div>
            </div>
          </div>

          <Button onClick={handleLogout} variant="destructive" className="w-full flex items-center gap-2">
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default ProfilePage;
