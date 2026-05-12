import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { LandingPage } from './LandingPage.tsx';
import { LanguageProvider } from './i18n.tsx';
import './index.css';

const isAppRoute = window.location.pathname.startsWith('/app');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      {isAppRoute ? <App /> : <LandingPage />}
    </LanguageProvider>
  </StrictMode>,
);
