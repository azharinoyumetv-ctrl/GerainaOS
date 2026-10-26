import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { canAccessPath } from '@/auth/permissions';
import { toast } from '@/components/ui/sonner';
import { SECTIONS, isPlanLocked, PLAN_LABEL } from './sections';

export default function SectionNavigation({ section, active }) {
  const { user } = useAuth();
  return <nav aria-label={`Navigasi ${section}`} className="flex flex-wrap gap-2 border-b border-[hsl(var(--border))] pb-3" data-testid={`${section}-tabs`}>
    {SECTIONS[section].filter(tab => canAccessPath(user?.role, tab.path)).map(tab => {
      const className = `px-4 py-2 rounded-xl text-xs font-bold transition-all ${active === tab.id ? 'bg-[hsl(var(--primary))] text-white shadow-md' : 'bg-[hsl(var(--surface))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))]'}`;
      return isPlanLocked(tab.minPlan, user?.plan)
        ? <button key={tab.id} type="button" className={className} onClick={() => toast.error(`Fitur ini tersedia dalam paket ${PLAN_LABEL[tab.minPlan]}.`)}><Lock size={12} className="inline mr-1" />{tab.label}</button>
        : <Link key={tab.id} to={tab.path} aria-current={active === tab.id ? 'page' : undefined} className={className}>{tab.label}</Link>;
    })}
  </nav>;
}
