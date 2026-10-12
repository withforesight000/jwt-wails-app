import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Wails injects runtime scripts into dev HTML without updating gzip headers.
  compress: process.env.NODE_ENV !== 'development',
  output: 'export',
  distDir: 'out',
  allowedDevOrigins: ['localhost', '*.localhost', '127.0.0.1', '::1'],
  turbopack: {
    root: rootDir,
  },
};
export default nextConfig;
