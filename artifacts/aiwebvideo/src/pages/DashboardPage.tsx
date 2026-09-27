import { DashboardClient } from '@/components/dashboard/DashboardClient';
import { useSeo } from '@/lib/useSeo';

export function DashboardPage() {
  useSeo({ title: 'Creator', description: 'Your private AiWebVideo creative session.', path: '/dashboard', noindex: true });
  return <DashboardClient />;
}
