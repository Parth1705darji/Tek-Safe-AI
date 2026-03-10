import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './styles/globals.css';
import App from './App';

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY environment variable');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider
      publishableKey={clerkPubKey}
      appearance={{
        variables: {
          colorPrimary: '#1E3A5F',
          colorTextOnPrimaryBackground: '#FFFFFF',
          borderRadius: '12px',
        },
        elements: {
          card: 'shadow-lg',
          formButtonPrimary: 'bg-primary hover:bg-primary/90',
        },
      }}
    >
      <App />
    </ClerkProvider>
  </StrictMode>
);
