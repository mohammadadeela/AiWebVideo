import { Link } from 'wouter';
import { Button } from '@/components/ui/app-button';
import { useSeo } from '@/lib/useSeo';

export function NotFoundPage() {
  useSeo({ title: 'Page not found', description: 'The page you are looking for does not exist.', path: '/404', noindex: true });
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-5">
      <div className="text-center">
        <p className="font-utility text-6xl font-bold text-text-dim">404</p>
        <h1 className="mt-4 font-display text-xl font-bold text-text-primary">Page not found</h1>
        <p className="mt-2 text-sm text-text-muted">The page you're looking for doesn't exist.</p>
        <Link href="/">
          <Button variant="primary" className="mt-6">Back to home</Button>
        </Link>
      </div>
    </div>
  );
}
