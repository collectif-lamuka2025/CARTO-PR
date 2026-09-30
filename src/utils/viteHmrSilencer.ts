/**
 * AI Studio Runtime Constraint: HMR is disabled. Ignore WebSocket errors.
 * Silences Vite HMR WebSocket connection attempts in the AI Studio preview environment.
 */
if (typeof window !== 'undefined') {
  try {
    // 1. Filter console.error, console.warn and unhandled errors first
    const origError = console.error;
    console.error = function (...args: any[]) {
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '[vite]' || (typeof a === 'string' && (a.includes('[vite]') || a.includes('vite-hmr')))) return;
        if (a && typeof a === 'object') {
          const m = (a as any).message || (a as any).stack || '';
          if (typeof m === 'string' && (m.includes('[vite]') || m.includes('websocket') || m.includes('WebSocket'))) return;
        }
      }
      origError.apply(console, args);
    };

    const origWarn = console.warn;
    console.warn = function (...args: any[]) {
      for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if (a === '[vite]' || (typeof a === 'string' && (a.includes('[vite]') || a.includes('vite-hmr')))) return;
        if (a && typeof a === 'object') {
          const m = (a as any).message || (a as any).stack || '';
          if (typeof m === 'string' && (m.includes('[vite]') || m.includes('websocket') || m.includes('WebSocket'))) return;
        }
      }
      origWarn.apply(console, args);
    };

    window.addEventListener(
      'error',
      function (e: ErrorEvent) {
        const m = e?.message || '';
        if (m.includes('[vite]') || m.includes('websocket') || m.includes('WebSocket')) {
          e.stopImmediatePropagation();
          e.preventDefault();
        }
      },
      true
    );

    window.addEventListener(
      'unhandledrejection',
      function (e: PromiseRejectionEvent) {
        const r = (e as any)?.reason;
        const m = typeof r === 'string' ? r : r?.message || '';
        if (m.includes('[vite]') || m.includes('websocket') || m.includes('WebSocket')) {
          e.stopImmediatePropagation();
          e.preventDefault();
        }
      },
      true
    );

    // 2. Safely mock WebSocket for 'vite-hmr' without throwing setter errors
    const OrigWebSocket = window.WebSocket;
    if (OrigWebSocket) {
      const ViteSilentWebSocket = function (url: string | URL, protocols?: string | string[]) {
        const protoStr = Array.isArray(protocols) ? protocols.join(' ') : (protocols || '');
        const urlStr = String(url);
        const isVite =
          protoStr.includes('vite') ||
          urlStr.includes('vite-hmr') ||
          urlStr.includes('token=') ||
          urlStr.includes('vite-ping');

        if (isVite) {
          const target = new EventTarget() as any;
          target.binaryType = 'blob';
          target.readyState = 1; // WebSocket.OPEN
          target.url = urlStr;
          target.protocol = Array.isArray(protocols) ? protocols[0] : (protocols || '');
          target.extensions = '';
          target.bufferedAmount = 0;
          target.send = function () {};
          target.close = function () {
            target.readyState = 3; // CLOSED
            if (typeof target.onclose === 'function') target.onclose(new Event('close'));
            target.dispatchEvent(new Event('close'));
          };
          target.onopen = null;
          target.onclose = null;
          target.onerror = null;
          target.onmessage = null;

          setTimeout(function () {
            if (typeof target.onopen === 'function') target.onopen(new Event('open'));
            target.dispatchEvent(new Event('open'));
          }, 5);

          return target;
        }
        return new OrigWebSocket(url, protocols);
      } as any;

      ViteSilentWebSocket.prototype = OrigWebSocket.prototype;
      ViteSilentWebSocket.CONNECTING = OrigWebSocket.CONNECTING;
      ViteSilentWebSocket.OPEN = OrigWebSocket.OPEN;
      ViteSilentWebSocket.CLOSING = OrigWebSocket.CLOSING;
      ViteSilentWebSocket.CLOSED = OrigWebSocket.CLOSED;

      try {
        Object.defineProperty(window, 'WebSocket', {
          value: ViteSilentWebSocket,
          configurable: true,
          writable: true,
        });
      } catch (_) {
        // Silently continue if window.WebSocket cannot be redefined
      }
    }
  } catch (_) {}
}

export {};
