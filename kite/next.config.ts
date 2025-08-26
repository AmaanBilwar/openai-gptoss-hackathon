import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Exclude Node.js specific modules from client-side bundling
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        os: false,
        crypto: false,
        stream: false,
        util: false,
        buffer: false,
        events: false,
        assert: false,
        constants: false,
        domain: false,
        http: false,
        https: false,
        querystring: false,
        url: false,
        zlib: false,
      };
    }

    // Exclude problematic packages from client-side bundling
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push({
        'keyring': 'commonjs keyring',
        'hoek': 'commonjs hoek',
        'hawk': 'commonjs hawk',
        'winston': 'commonjs winston',
        'request': 'commonjs request',
      });
    }

    return config;
  },
  // Ensure API routes are server-side only
  experimental: {
    serverComponentsExternalPackages: ['keyring', 'hoek', 'hawk', 'winston', 'request'],
  },
};

export default nextConfig;
