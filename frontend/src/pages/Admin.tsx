import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ShieldCheck } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useToast } from '@/hooks/use-toast';
import { adminService } from '@/services/admin';
import { COUNTRY_ID_BY_NAME, COUNTRY_NAME_BY_ID, COUNTRY_OPTIONS, type CountryOption } from '@/lib/countries';

const AdminPage = () => {
  const { toast } = useToast();
  const [nationAId, setNationAId] = useState<number | null>(null);
  const [nationBId, setNationBId] = useState<number | null>(null);
  const [countryFilterA, setCountryFilterA] = useState('');
  const [countryFilterB, setCountryFilterB] = useState('');
  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setNationAId(null);
    setNationBId(null);
    setCountryFilterA('');
    setCountryFilterB('');
    setScoreA('');
    setScoreB('');
  };

  const nationAName = nationAId ? (COUNTRY_NAME_BY_ID.get(nationAId) ?? null) : null;
  const nationBName = nationBId ? (COUNTRY_NAME_BY_ID.get(nationBId) ?? null) : null;

  const filteredA = useMemo(
    () => COUNTRY_OPTIONS.filter(c => c.name.toLowerCase().includes(countryFilterA.toLowerCase())),
    [countryFilterA]
  );
  const filteredB = useMemo(
    () => COUNTRY_OPTIONS.filter(c => c.name.toLowerCase().includes(countryFilterB.toLowerCase())),
    [countryFilterB]
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const aId = nationAId;
    const bId = nationBId;
    const aGoals = Number(scoreA);
    const bGoals = Number(scoreB);

    if (!aId || !bId) {
      toast({
        title: 'Select both countries',
        description: 'Pick Nation A and Nation B from the country lists.',
        variant: 'destructive',
      });
      return;
    }
    if (aId === bId) {
      toast({
        title: 'Invalid match',
        description: 'Nation A and Nation B must be different.',
        variant: 'destructive',
      });
      return;
    }
    if (!Number.isInteger(aGoals) || !Number.isInteger(bGoals) || aGoals < 0 || bGoals < 0) {
      toast({
        title: 'Invalid score',
        description: 'Scores must be integers greater than or equal to 0.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      await adminService.submitMatchResult({
        nation_a_id: aId,
        nation_b_id: bId,
        score_a: aGoals,
        score_b: bGoals,
      });
      toast({
        title: 'Result processed',
        description: 'Match saved and squad points were recalculated.',
      });
      resetForm();
    } catch (error) {
      toast({
        title: 'Could not process result',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl text-gold-gradient">Administrator - Match Results</h1>
          <p className="text-muted-foreground mt-1">
            Submit official match results to update squad points across all users.
          </p>
        </div>

        <div className="glass-card rounded-xl p-6 space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Scoring rules applied automatically</p>
              <p>Win: 3 points per player nationality match · Draw: 1 point · Loss: 0 points.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nation A</label>
                <Accordion type="single" collapsible className="rounded-md border border-border/50 px-3 bg-muted/20">
                  <AccordionItem value="nation-a" className="border-b-0">
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <span className={nationAName ? 'text-base font-bold text-foreground' : 'text-sm text-muted-foreground'}>
                        {nationAName ?? 'Select Nation A'}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <Input
                        placeholder="Filter countries..."
                        value={countryFilterA}
                        onChange={e => setCountryFilterA(e.target.value)}
                        className="bg-muted/50 border-border/50"
                      />
                      <div className="max-h-56 overflow-y-auto rounded border border-border/40">
                        {filteredA.map((country: CountryOption) => (
                          <button
                            key={`a-${country.id}`}
                            type="button"
                            onClick={() => setNationAId(COUNTRY_ID_BY_NAME.get(country.name) ?? country.id)}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                              nationAId === country.id
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-muted/40 text-foreground'
                            }`}
                          >
                            {country.name}
                          </button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nation B</label>
                <Accordion type="single" collapsible className="rounded-md border border-border/50 px-3 bg-muted/20">
                  <AccordionItem value="nation-b" className="border-b-0">
                    <AccordionTrigger className="py-3 hover:no-underline">
                      <span className={nationBName ? 'text-base font-bold text-foreground' : 'text-sm text-muted-foreground'}>
                        {nationBName ?? 'Select Nation B'}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="space-y-2">
                      <Input
                        placeholder="Filter countries..."
                        value={countryFilterB}
                        onChange={e => setCountryFilterB(e.target.value)}
                        className="bg-muted/50 border-border/50"
                      />
                      <div className="max-h-56 overflow-y-auto rounded border border-border/40">
                        {filteredB.map((country: CountryOption) => (
                          <button
                            key={`b-${country.id}`}
                            type="button"
                            onClick={() => setNationBId(COUNTRY_ID_BY_NAME.get(country.name) ?? country.id)}
                            className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                              nationBId === country.id
                                ? 'bg-primary/10 text-primary'
                                : 'hover:bg-muted/40 text-foreground'
                            }`}
                          >
                            {country.name}
                          </button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nation A Goals</label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g. 2"
                  value={scoreA}
                  onChange={e => setScoreA(e.target.value)}
                  className="bg-muted/50 border-border/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Nation B Goals</label>
                <Input
                  inputMode="numeric"
                  placeholder="e.g. 1"
                  value={scoreB}
                  onChange={e => setScoreB(e.target.value)}
                  className="bg-muted/50 border-border/50"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={submitting} className="btn-gold min-w-36">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Result'}
              </Button>
            </div>
          </form>
        </div>
      </motion.div>
    </AppLayout>
  );
};

export default AdminPage;
