import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
// basicSsl: mobile browsers only allow camera + GPS on HTTPS (or localhost).
// js-aruco2 is a CommonJS file that exports with `this.AR = AR`. In an ES-module production bundle `this` is
// undefined, so AR was never exported (dev worked, build did not): "Cannot read properties of undefined (reading 'Detector')".
const fixAruco = () => ({
  name: 'fix-js-aruco2-exports', enforce: 'pre',
  transform(code, id) {
    if (!/js-aruco2[\\/]src[\\/](aruco|cv)\.js$/.test(id)) return null;
    return code.replace(/\bthis\.(AR|CV)\b/g, 'exports.$1');
  },
});
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [fixAruco(), react(), tailwindcss(), basicSsl()],
    server: { host: true, port: Number(env.VITE_PORT) || 5173, strictPort: true, fs: { allow: ['..'] },
      proxy: { '/api': { target: env.VITE_API_TARGET || 'http://127.0.0.1:5001', changeOrigin: true } } },
  };
});