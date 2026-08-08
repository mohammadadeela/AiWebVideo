import { Link } from 'wouter';
import { Wordmark } from '@/components/ui/Wordmark';

export function Footer() {
  return (
    <footer className="border-t border-border mt-8">
      <div className="mx-auto max-w-6xl px-5 py-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 mb-8">
          <div className="col-span-2 sm:col-span-1">
            <Wordmark />
            <p className="mt-3 text-xs text-text-dim leading-relaxed max-w-[200px]">
              Turn your real website into professional promo videos and marketing photos with AI.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3">Product</p>
            <ul className="space-y-2 text-sm text-text-muted">
              <li><Link href="/features" className="hover:text-text-primary transition-colors">Features</Link></li>
              <li><Link href="/how-it-works" className="hover:text-text-primary transition-colors">How it works</Link></li>
              <li><Link href="/pricing" className="hover:text-text-primary transition-colors">Pricing</Link></li>
              <li><Link href="/dashboard" className="hover:text-text-primary transition-colors">Dashboard</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3">Use cases</p>
            <ul className="space-y-2 text-sm text-text-muted">
              <li><Link href="/features" className="hover:text-text-primary transition-colors">SaaS demos</Link></li>
              <li><Link href="/features" className="hover:text-text-primary transition-colors">Product launches</Link></li>
              <li><Link href="/features" className="hover:text-text-primary transition-colors">Social campaigns</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-text-dim mb-3">Company</p>
            <ul className="space-y-2 text-sm text-text-muted">
              <li><Link href="/about" className="hover:text-text-primary transition-colors">About</Link></li>
              <li><Link href="/faq" className="hover:text-text-primary transition-colors">Help & FAQ</Link></li>
              <li><Link href="/profile" className="hover:text-text-primary transition-colors">Account</Link></li>
            </ul>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-border pt-6">
          <p className="text-xs text-text-dim">© {new Date().getFullYear()} AiWebVideo · talk it into a video</p>
          <div className="flex gap-4 text-xs text-text-dim">
            <Link href="/privacy" className="hover:text-text-muted">Privacy</Link>
            <Link href="/terms" className="hover:text-text-muted">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
