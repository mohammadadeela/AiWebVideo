import { lazy, Suspense } from 'react';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { AppErrorBoundary } from '@/components/system/AppErrorBoundary';

const HomePage = lazy(() => import('@/pages/HomePage').then((module) => ({ default: module.HomePage })));
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((module) => ({ default: module.DashboardPage })));
const PricingPage = lazy(() => import('@/pages/PricingPage').then((module) => ({ default: module.PricingPage })));
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));
const AdminPage = lazy(() => import('@/pages/AdminPage').then((module) => ({ default: module.AdminPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })));
const StudioIndexPage = lazy(() => import('@/pages/StudioIndexPage').then((module) => ({ default: module.StudioIndexPage })));
const StudioProductPage = lazy(() => import('@/pages/StudioPage').then((module) => ({ default: () => <module.StudioPage kind="product" /> })));
const StudioIdeaPage = lazy(() => import('@/pages/StudioPage').then((module) => ({ default: () => <module.StudioPage kind="idea" /> })));
const StudioScenarioPage = lazy(() => import('@/pages/StudioPage').then((module) => ({ default: () => <module.StudioPage kind="scenario" /> })));
const contentPages = () => import('@/pages/ContentPages');
const AboutPage = lazy(() => contentPages().then((module) => ({ default: module.AboutPage })));
const FaqPage = lazy(() => contentPages().then((module) => ({ default: module.FaqPage })));
const FeaturesPage = lazy(() => contentPages().then((module) => ({ default: module.FeaturesPage })));
const HowItWorksPage = lazy(() => contentPages().then((module) => ({ default: module.HowItWorksPage })));
const PrivacyPage = lazy(() => contentPages().then((module) => ({ default: module.PrivacyPage })));
const TermsPage = lazy(() => contentPages().then((module) => ({ default: module.TermsPage })));
const searchPages = () => import('@/pages/SearchLandingPages');
const UrlToVideoPage = lazy(() => searchPages().then((module) => ({ default: module.UrlToVideoPage })));
const WebsiteVideoGeneratorPage = lazy(() => searchPages().then((module) => ({ default: module.WebsiteVideoGeneratorPage })));
const SaasDemoVideoGeneratorPage = lazy(() => searchPages().then((module) => ({ default: module.SaasDemoVideoGeneratorPage })));
const ProductPageToVideoPage = lazy(() => searchPages().then((module) => ({ default: module.ProductPageToVideoPage })));
const ExamplesPage = lazy(() => searchPages().then((module) => ({ default: module.ExamplesPage })));
const guidePages = () => import('@/pages/GuidesPage');
const WebsiteToVideoGuidePage = lazy(() => guidePages().then((module) => ({ default: module.WebsiteToVideoGuidePage })));
const SaasProductVideoGuidePage = lazy(() => guidePages().then((module) => ({ default: module.SaasProductVideoGuidePage })));
const ProductPageVideoGuidePage = lazy(() => guidePages().then((module) => ({ default: module.ProductPageVideoGuidePage })));

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg" role="status" aria-label="Loading AiWebVideo">
      <div className="flex flex-col items-center gap-4">
        <img src="/logo.svg" alt="" className="h-12 w-12 animate-pulse" />
        <div className="h-1 w-20 overflow-hidden rounded-full bg-white/[.06]">
          <div className="h-full w-1/2 animate-pulse rounded-full bg-violet" />
        </div>
      </div>
    </div>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/pricing" component={PricingPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/studio" component={StudioIndexPage} />
      <Route path="/studio/product" component={StudioProductPage} />
      <Route path="/studio/idea" component={StudioIdeaPage} />
      <Route path="/studio/scenario" component={StudioScenarioPage} />
      <Route path="/url-to-video" component={UrlToVideoPage} />
      <Route path="/website-video-generator" component={WebsiteVideoGeneratorPage} />
      <Route path="/saas-demo-video-generator" component={SaasDemoVideoGeneratorPage} />
      <Route path="/product-page-to-video" component={ProductPageToVideoPage} />
      <Route path="/examples" component={ExamplesPage} />
      <Route path="/guides/turn-website-into-video" component={WebsiteToVideoGuidePage} />
      <Route path="/guides/saas-product-demo-video" component={SaasProductVideoGuidePage} />
      <Route path="/guides/product-page-video-ads" component={ProductPageVideoGuidePage} />
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
