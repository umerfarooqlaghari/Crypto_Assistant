import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Environment variables
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001',
  },

  // Image optimization
  images: {
    domains: ['localhost'],
    unoptimized: true
  },

  // Disable x-powered-by header
  poweredByHeader: false,

  // Enable compression
  compress: true,
};

export default nextConfig;
