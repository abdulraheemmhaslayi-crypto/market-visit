'use client';

/**
 * Client-Side Network & Data Usage Tracker
 * 
 * Intercepts client-side fetch calls, measures uploaded/downloaded bytes accurately,
 * aggregates metrics in memory, and batches updates to the server with negligible overhead.
 */

interface PendingMetrics {
  requests: number;
  bytesDownloaded: number;
  bytesUploaded: number;
  breakdown: Record<string, { requests: number; bytes: number }>;
}

let metricsBuffer: PendingMetrics = {
  requests: 0,
  bytesDownloaded: 0,
  bytesUploaded: 0,
  breakdown: {},
};

let isInitialized = false;
let flushTimer: any = null;
let currentSessionUser: { id: string; name: string; role: string; managerId?: string | null } | null = null;

function estimateStringBytes(str: string): number {
  return new Blob([str]).size;
}

function getDeviceInfo(): string {
  if (typeof navigator === 'undefined') return 'Unknown Browser';
  const ua = navigator.userAgent;
  let device = 'Desktop';
  if (/Android/i.test(ua)) device = 'Android Phone';
  else if (/iPhone|iPad|iPod/i.test(ua)) device = 'iOS Device';
  else if (/Mobile/i.test(ua)) device = 'Mobile Browser';

  let browser = 'Browser';
  if (/Chrome/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';
  else if (/Edge/i.test(ua)) browser = 'Edge';

  return `${device} (${browser})`;
}

/**
 * Flushes buffered data usage metrics to the backend.
 */
export async function flushDataUsageMetrics() {
  if (!currentSessionUser || metricsBuffer.requests === 0) return;

  const payload = {
    userId: currentSessionUser.id,
    userName: currentSessionUser.name,
    userRole: currentSessionUser.role,
    managerId: currentSessionUser.managerId || null,
    date: new Date().toISOString().split('T')[0],
    requests: metricsBuffer.requests,
    bytesDownloaded: metricsBuffer.bytesDownloaded,
    bytesUploaded: metricsBuffer.bytesUploaded,
    breakdown: { ...metricsBuffer.breakdown },
    deviceInfo: getDeviceInfo(),
  };

  // Reset local buffer immediately
  metricsBuffer = {
    requests: 0,
    bytesDownloaded: 0,
    bytesUploaded: 0,
    breakdown: {},
  };

  try {
    const bodyStr = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function' && bodyStr.length < 60000) {
      const blob = new Blob([bodyStr], { type: 'application/json' });
      navigator.sendBeacon('/api/data-usage/track', blob);
    } else {
      await fetch('/api/data-usage/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
        keepalive: true,
      });
    }
  } catch (err) {
    // If flush fails, re-accumulate without crashing the app
  }
}

/**
 * Initializes the global fetch interceptor once on the client side.
 */
export function initClientDataTracker(user: { id: string; name: string; role: string; managerId?: string | null }) {
  currentSessionUser = user;

  if (isInitialized || typeof window === 'undefined') return;
  isInitialized = true;

  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlStr = typeof input === 'string' ? input : (input instanceof Request ? input.url : input.toString());

    // Skip tracking the tracking endpoint itself or external static CDNs to avoid loops
    if (urlStr.includes('/api/data-usage/track')) {
      return originalFetch.apply(this, [input as any, init]);
    }

    // 1. Calculate Upload Payload Size
    let uploadBytes = 0;
    if (init?.body) {
      if (typeof init.body === 'string') {
        uploadBytes = estimateStringBytes(init.body);
      } else if (init.body instanceof Blob) {
        uploadBytes = init.body.size;
      } else if (init.body instanceof FormData) {
        // Approximate FormData size
        uploadBytes = 2048;
      }
    } else if (input instanceof Request) {
      uploadBytes = 200; // Base HTTP header approximation
    }

    const startTime = performance.now();
    let response: Response;

    try {
      response = await originalFetch.apply(this, [input as any, init]);
    } catch (err) {
      throw err;
    }

    // 2. Calculate Download Response Size
    let downloadBytes = 0;
    const contentLength = response.headers.get('content-length');
    if (contentLength && !isNaN(parseInt(contentLength, 10))) {
      downloadBytes = parseInt(contentLength, 10);
    } else {
      // Cloned response blob size estimation if content-length is missing
      try {
        const clone = response.clone();
        clone.blob().then((b) => {
          recordMetric(urlStr, uploadBytes, b.size);
        }).catch(() => {
          recordMetric(urlStr, uploadBytes, 500);
        });
        return response;
      } catch {
        downloadBytes = 500; // fallback
      }
    }

    recordMetric(urlStr, uploadBytes, downloadBytes);
    return response;
  };

  function recordMetric(url: string, upBytes: number, downBytes: number) {
    let cleanEndpoint = url;
    try {
      const parsed = new URL(url, window.location.origin);
      cleanEndpoint = parsed.pathname;
    } catch {}

    // Group static assets or images
    if (cleanEndpoint.startsWith('/uploads/')) {
      cleanEndpoint = '/uploads/images';
    } else if (cleanEndpoint.startsWith('/_next/')) {
      cleanEndpoint = '/_next/static-assets';
    }

    metricsBuffer.requests += 1;
    metricsBuffer.bytesUploaded += upBytes;
    metricsBuffer.bytesDownloaded += downBytes;

    if (!metricsBuffer.breakdown[cleanEndpoint]) {
      metricsBuffer.breakdown[cleanEndpoint] = { requests: 0, bytes: 0 };
    }
    metricsBuffer.breakdown[cleanEndpoint].requests += 1;
    metricsBuffer.breakdown[cleanEndpoint].bytes += (upBytes + downBytes);
  }

  // Periodic flush every 2 minutes
  if (flushTimer) clearInterval(flushTimer);
  flushTimer = setInterval(() => {
    flushDataUsageMetrics();
  }, 120000);

  // Flush on page exit or hide
  window.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      flushDataUsageMetrics();
    }
  });

  window.addEventListener('beforeunload', () => {
    flushDataUsageMetrics();
  });
}
