// Config em JavaScript puro (não .ts) de propósito: na Hostinger a glibc é antiga demais para o SWC nativo, o Next
// cai para o SWC em WebAssembly e falha ao transpilar um next.config.ts. Pelo mesmo motivo o build usa --webpack
// (o Turbopack exige o binário nativo).

/** @type {import('next').NextConfig} */
const nextConfig = {
  // mysql2 usa recursos do Node que não devem ser empacotados pelo bundler
  serverExternalPackages: ['mysql2'],
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'microphone=(self), camera=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
