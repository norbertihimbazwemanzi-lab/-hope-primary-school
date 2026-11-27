import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import {AppErrorBoundary} from './components/AppErrorBoundary.tsx';
import './index.css';

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
