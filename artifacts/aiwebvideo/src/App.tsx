import { lazy, Suspense } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AppErrorBoundary } from '@/components/system/AppErrorBoundary';

const HomePage = lazy(() => import('@/pages/HomePage').then((module) => ({ default: module.HomePage })));
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const PricingPage = lazy(() => import('@/pages/PricingPage').then((module) => ({ default: module.PricingPage })));
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const AdminPage = lazy(() => import('@/pages/AdminPage').then((module) => ({ default: module.AdminPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));
const contentPages = () => import('@/pages/ContentPages');
const AboutPage = lazy(() => contentPages().then((module) => ({ default: module.AboutPage })));
const FaqPage = lazy(() => contentPages().then((module) => ({ default: module.FaqPage })));
const FeaturesPage = lazy(() => contentPages().then((module) => ({ default: module.FeaturesPage })));
const HowItWorksPage = lazy(() => contentPages().then((module) => ({ default: module.HowItWorksPage })));
const PrivacyPage = lazy(() => contentPages().then((module) => ({ default: module.PrivacyPage })));
const TermsPage = lazy(() => contentPages().then((module) => ({ default: module.TermsPage })));

function PageLoader() {
  return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-violet border-t-transparent" /></div>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/features" component={FeaturesPage} />
      <Route path="/how-it-works" component={HowItWorksPage} />
      <Route path="/about" component={AboutPage} />
      <Route path="/faq" component={FaqPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route component={NotFoundPage} />
    </Switch>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Suspense fallback={<PageLoader />}><Router /></Suspense>
      </WouterRouter>
    </AppErrorBoundary>
  );
}

export default App;
