import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages 배포 시 저장소 이름이 경로에 포함되지 않으므로 루트 경로 사용
  // 또는 저장소 이름을 포함하려면 '/exchangealert/dollar-investment-web/' 사용
  base: process.env.NODE_ENV === 'production' ? '/exchangealert/dollar-investment-web/' : '/',
})
