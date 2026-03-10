import { useEffect } from 'react';

const CHATWOOT_TOKEN = import.meta.env.VITE_CHATWOOT_WEBSITE_TOKEN as string | undefined;
const CHATWOOT_BASE = 'https://app.chatwoot.com';

declare global {
  interface Window {
    chatwootSDK?: { run: (config: { websiteToken: string; baseUrl: string }) => void };
    $chatwoot?: { toggle: (state?: 'open' | 'close') => void };
  }
}

const ChatwootWidget = () => {
  useEffect(() => {
    if (!CHATWOOT_TOKEN || CHATWOOT_TOKEN === 'your_token_here') return;

    // Avoid double-loading
    if (document.getElementById('chatwoot-sdk')) return;

    const script = document.createElement('script');
    script.id = 'chatwoot-sdk';
    script.src = `${CHATWOOT_BASE}/packs/js/sdk.js`;
    script.defer = true;
    script.async = true;
    script.onload = () => {
      window.chatwootSDK?.run({
        websiteToken: CHATWOOT_TOKEN,
        baseUrl: CHATWOOT_BASE,
      });
    };
    document.head.appendChild(script);
  }, []);

  return null;
};

export default ChatwootWidget;
