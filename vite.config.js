import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // IMPORTANT: Change 'gs-valuation-model' to your actual GitHub repo name
  // If deploying to https://username.github.io/gs-valuation-model/
  // then base should be '/gs-valuation-model/'
  // If deploying to a custom domain, set base to '/'
  base: '/gs-valuation-model/',
})
