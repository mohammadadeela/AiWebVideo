import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Wordmark } from '@/components/ui/Wordmark';
import { Button } from '@/components/ui/app-button';
import { AuthModal } from '@/components/auth/AuthModal';
import { UserMenu } from '@/components/account/UserMenu';
import { fetchMe } from '@/lib/api-client';
import { watchAuthState } from '@/lib/firebase/client';

interface Me { email: string; plan: string; creditsBalance: number; }

export function Nav() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [, navigate] = useLocation();

  useEffect(() => watchAuthState((u) => {
    setIsSignedIn(!!u);
    if (u) void fetchMe().then(setMe).catch(() => setMe(null));
    else setMe(null);
  }), []);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`sticky top-0 z-40 border-b border-border transition-all duration-200 ${scrolled ? 'bg-bg/95 backdrop-blur' : 'bg-transparent'}`}>
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/" className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet rounded-lg">
          <Wordmark />
        </Link>
        <div className="hidden items-center gap-6 text-sm text-text-muted md:flex">
          <Link href="/features" className="hover:text-text-primary transition-colors">Features</Link>
          <Link href="/how-it-works" className="hover:text-text-primary transition-colors">How it works</Link>
          <Link href="/pricing" className="hover:text-text-primary transition-colors">Pricing</Link>
        </div>
        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <>
              <Link href="/dashboard"><Button variant="secondary" size="sm">Open workspace</Button></Link>
              {me && <UserMenu email={me.email} plan={me.plan} creditsBalance={me.creditsBalance} />}
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => setShowAuthModal(true)}>Log in</Button>
              <a href="/#generate">
                <Button variant="primary" size="sm">Try it free</Button>
              </a>
            </>
          )}
        </div>
      </nav>

      {showAuthModal && (
        <AuthModal onClose={() => setShowAuthModal(false)} onSignedIn={() => { setShowAuthModal(false); navigate('/dashboard'); }} />
      )}
    </header>
  );
}
