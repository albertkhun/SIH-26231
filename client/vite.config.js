import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
// basicSsl: mobile browsers only allow camera + GPS on HTTPS (or localhost).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), tailwindcss(), basicSsl()],
    server: { host: true, port: Number(env.VITE_PORT) || 5173, strictPort: true, fs: { allow: ['..'] },
      proxy: { '/api': { target: env.VITE_API_TARGET || 'http://127.0.0.1:5001', changeOrigin: true } } },
  };
});
