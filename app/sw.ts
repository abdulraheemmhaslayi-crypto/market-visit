import { 
  CacheFirst, 
  NetworkFirst, 
  StaleWhileRevalidate, 
  NetworkOnly,
  Serwist,
  ExpirationPlugin 
} from "serwist";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

declare const self: ServiceWorkerGlobalScope & {
  __SW_MANIFEST: (string | PrecacheEntry)[] | undefined;
};

// Define custom cache names
const CACHE_NAMES = {
  fonts: "fonts-v1",
  images: "images-v1",
  static: "static-assets-v1",
  api: "api-v1",
  pages: "pages-v1",
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // 1. Fonts -> Cache First
    {
      matcher: ({ request }) => request.destination === "font",
      handler: new CacheFirst({
        cacheName: CACHE_NAMES.fonts,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 15,
            maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
          }),
        ],
      }),
    },
    // 2. Images -> Cache First
    {
      matcher: ({ request }) => request.destination === "image",
      handler: new CacheFirst({
        cacheName: CACHE_NAMES.images,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 60,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          }),
        ],
      }),
    },
    // 3. Static Assets (CSS, JS) -> Cache First
    {
      matcher: ({ request }) => request.destination === "script" || request.destination === "style",
      handler: new CacheFirst({
        cacheName: CACHE_NAMES.static,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          }),
        ],
      }),
    },
    // 4. NextAuth API requests -> Network Only (should not cache auth calls)
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/auth/"),
      handler: new NetworkOnly(),
    },
    // 5. General API requests -> Network First
    {
      matcher: ({ url }) => url.pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: CACHE_NAMES.api,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 100,
            maxAgeSeconds: 24 * 60 * 60, // 24 hours
          }),
        ],
      }),
    },
    // 6. HTML pages -> Stale While Revalidate
    {
      matcher: ({ request }) => request.destination === "document",
      handler: new StaleWhileRevalidate({
        cacheName: CACHE_NAMES.pages,
        plugins: [
          new ExpirationPlugin({
            maxEntries: 50,
            maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
          }),
        ],
      }),
    },
  ],
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
