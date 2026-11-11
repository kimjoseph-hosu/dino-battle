// npm run dev 하나로 화면 + AI 프록시(/api)를 함께 띄운다. 키는 .env 에서 서버 쪽만 읽는다(VITE_ 접두어가 없어 브라우저로 안 감)
import { defineConfig, loadEnv } from 'vite';
import { aiMiddleware } from './server/ai.js';

export default defineConfig(({ mode }) => ({
  server: { watch: { ignored: ['**/data/ai_animals.json', '**/reference/**'] } }, // AI 캐시가 바뀌어도 화면을 새로고침하지 않게
  plugins: [{ name: 'ai-proxy', configureServer: server => { server.middlewares.use(aiMiddleware(loadEnv(mode, process.cwd(), ''))); } }],
}));
