import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// https://astro.build/config — updated for cardio theme
export default defineConfig({
  site: 'https://ip360.in',
  integrations: [react()],
  vite: {
    envPrefix: ['VITE_', 'PUBLIC_'],
    optimizeDeps: {
      include: ['@phosphor-icons/react', 'framer-motion', 'lenis', 'react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', '@supabase/supabase-js']
    }
  }
});