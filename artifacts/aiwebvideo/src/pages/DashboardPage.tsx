import { DashboardClient } from '@/components/dashboard/DashboardClient';
import { useSeo } from '@/lib/useSeo';

export function DashboardPage() {
  useSeo({ title: 'My Creations', description: 'Your AiWebVideo creations, projects, and production history.', path: '/dashboard', noindex: true });
  return <DashboardClient />;
}
