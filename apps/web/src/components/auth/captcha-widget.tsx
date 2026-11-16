'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: {
        sitekey: string;
        action?: string;
        callback: (token: string) => void;
        'expired-callback': () => void;
        'error-callback': () => void;
      }) => string;
      remove: (widgetId: string) => void;
    };
  }
}

export function CaptchaWidget({ onToken, action = 'register' }: { onToken: (token: string) => void; action?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | undefined>(undefined);
  const [ready, setReady] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !containerRef.current) return;
    const render = () => {
      if (!window.turnstile || !containerRef.current || widgetId.current) return;
      widgetId.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action,
        callback: (token) => { onToken(token); setReady(true); },
        'expired-callback': () => { onToken(''); setReady(false); },
        'error-callback': () => { onToken(''); setReady(false); },
      });
    };

    let script = document.querySelector<HTMLScriptElement>('script[data-turnstile]');
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.turnstile = 'true';
      document.head.appendChild(script);
    }
    script.addEventListener('load', render);
    render();
    return () => {
      script?.removeEventListener('load', render);
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = undefined;
    };
  }, [onToken, siteKey, action]);

  if (!siteKey) return <p role="status">La verificación CAPTCHA no está configurada.</p>;
  return <fieldset className="captcha-box">
    <legend>Verificación anti-automatización</legend>
    <div ref={containerRef} />
    <span className="sr-only" aria-live="polite">{ready ? 'Verificación completada.' : 'Completa la verificación CAPTCHA.'}</span>
  </fieldset>;
}
