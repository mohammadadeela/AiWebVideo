import { DashboardClient } from '@/components/dashboard/DashboardClient';
import { useSeo } from '@/lib/useSeo';

export function DashboardPage() {
  useSeo({ title: 'Workspace', description: 'Your Linkreel production workspace.', path: '/dashboard', noindex: true });
  return <DashboardClient />;
}
