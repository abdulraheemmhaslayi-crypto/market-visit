import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";
import crypto from "crypto";

const revision = crypto.randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  register: false,
  additionalPrecacheEntries: [{ url: "/offline", revision }],
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "http://localhost:3000",
    "fields-visit-system-bccyaue6cyadaeh9.centralindia-01.azurewebsites.net",
  ],
  output: "standalone",

  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default withSerwist(nextConfig);