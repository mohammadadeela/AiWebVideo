import { useEffect } from 'react';
import { useSeo } from '@/lib/useSeo';

export function DashboardPage() {
  useSeo({ title: 'Creator', description: 'Your private AiWebVideo creative session.', path: '/dashboard', noindex: true });
  useEffect(() => {
    window.location.replace(`/${window.location.search}#generate`);
  }, []);
  return null;
}
