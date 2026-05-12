import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { LandingPage } from './LandingPage.tsx';
import './index.css';

const isAppRoute = window.location.pathname.startsWith('/app');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAppRoute ? <App /> : <LandingPage />}
  </StrictMode>,
);
