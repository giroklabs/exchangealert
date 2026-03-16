import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 커스텀 도메인(dollarinvest.pro) 사용 시 루트 경로('/')를 사용해야 함
  base: '/',
})
