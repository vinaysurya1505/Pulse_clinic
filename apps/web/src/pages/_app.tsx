import type { AppProps } from 'next/app';
import { AuthProvider } from '@/context/AuthContext';
import { StoreProvider } from '@/context/StoreContext';
import '@/styles/globals.css';
import '@/styles/accessibility.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <StoreProvider>
        <a href="#main-content" className="skip-to-content">
          Skip to main content
        </a>
        <Component {...pageProps} />
      </StoreProvider>
    </AuthProvider>
  );
}
