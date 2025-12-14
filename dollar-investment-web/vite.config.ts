import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // GitHub Pages 배포 시 저장소 이름이 경로에 포함됨
  // 저장소가 exchangealert이면 URL은 giroklabs.github.io/exchangealert/가 됨
  base: process.env.NODE_ENV === 'production' ? '/exchangealert/' : '/',
})
