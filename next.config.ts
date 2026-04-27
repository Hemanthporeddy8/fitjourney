// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  webpack: (config, { isServer }) => {
    // Required for onnxruntime-web to work in Next.js
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    // Allow .wasm files
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },

  // Serve ONNX model files (.onnx and .onnx.data) with required COOP/COEP headers
  async headers() {
    return [
      {
        // Models directory: ONNX graph + external weight shard (.onnx.data)
        source: '/models/:path*',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp'           },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'            },
          { key: 'Content-Type',                 value: 'application/octet-stream'},
          { key: 'Cache-Control',                value: 'public, max-age=86400'  },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
          { key: 'Cross-Origin-Opener-Policy',   value: 'same-origin'  },
        ],
      },
    ];
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
