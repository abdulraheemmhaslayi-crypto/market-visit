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
  serverExternalPackages: ['mssql', 'mysql2'],
  allowedDevOrigins: [
    "http://localhost:3000",
    "dandyapp.tech",
    "*.dandyapp.tech",
    "fields-visit-system-bccyaue6cyadaeh9.centralindia-01.azurewebsites.net",
  ],
  output: "standalone",

  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        https: false,
        http: false,
        path: false,
        stream: false,
        zlib: false,
        os: false,
      };
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (resource: { request: string }) => {
          resource.request = resource.request.replace(/^node:/, "");
        })
      );
    }
    return config;
  },

  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
      allowedOrigins: [
        "dandyapp.tech",
        "*.dandyapp.tech",
        "fields-visit-system-bccyaue6cyadaeh9.centralindia-01.azurewebsites.net",
        "*.azurewebsites.net",
        "localhost:3000",
      ],
    },
  },
};

export default withSerwist(nextConfig);
