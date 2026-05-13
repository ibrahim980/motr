import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider } from './i18n.tsx';
import './index.css';

const App = lazy(() => import('./App.tsx'));
const LandingPage = lazy(() =>
  import('./LandingPage.tsx').then((m) => ({ default: m.LandingPage })),
);

const isAppRoute = window.location.pathname.startsWith('/app');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <Suspense fallback={null}>
        {isAppRoute ? <App /> : <LandingPage />}
      </Suspense>
    </LanguageProvider>
  </StrictMode>,
);
