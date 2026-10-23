/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx,astro}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Bold grotesk display for headlines, clean humanist sans for UI/body
        display: ['Sora', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        heading: ['Sora', 'system-ui', 'sans-serif'],
        // Legacy alias kept so any not-yet-migrated markup still resolves to display
        serif: ['Sora', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        // ---- Gynecology & Obstetrics Design System (Refined Navy & Dusty Peony) ----
        cardio: {
          bg: '#FAF8F5',         // Warm Alabaster canvas
          surface: '#FFFFFF',    // Pristine elevated card surface
          subtle: '#F4EFEB',     // Warm Sand / secondary fill
          navy: {
            DEFAULT: '#0B223D',  // Deep Midnight Navy (Headings & high-contrast text)
            deep: '#061628',     // Deepest Navy (Primary buttons & footers)
            surface: '#122D4F',  // Card dark surface
            muted: '#4B5E75',    // Secondary body text
            faint: '#7A8C9E',    // Subtle tertiary text / disabled
          },
          peony: {
            DEFAULT: '#C86D7C',  // Dusty Rose / Peony primary accent
            deep: '#B25464',     // Active / Hover state
            light: '#E297A4',    // Soft Accent highlight
            tint: '#FBF0F2',     // Pill badge / soft accent background
            border: '#F0D4DA',   // Soft accent border
          },
          border: {
            DEFAULT: '#E8DFD6',  // Warm structural border
            hairline: 'rgba(11, 34, 61, 0.08)',
          },
        },

        // ---- Existing monochrome & legacy tokens (retained for safe step-by-step migration) ----
        ink: {
          DEFAULT: '#0A0A0B',
          900: '#08080A',
          800: '#101012',
          700: '#18181B',
          600: '#232327',
          500: '#2E2E33',
        },
        chalk: {
          DEFAULT: '#F5F5F7',
          dim: '#C8C8CE',
        },
        ash: {
          DEFAULT: '#8A8A93',
          dark: '#5A5A61',
        },
        gold: {
          DEFAULT: '#E8E8EC',
          light: '#FFFFFF',
          dark: '#B9B9C0',
        },
        forest: {
          DEFAULT: '#0E0E10',
          light: '#18181B',
          dark: '#09090B',
        },
        cream: '#EDEDEF',
      },
      letterSpacing: {
        'widest-xl': '0.25em',
        'widest-2xl': '0.35em',
      },
      boxShadow: {
        'doppelrand': '0 0 0 1px rgba(28, 25, 23, 0.08), 0 20px 40px -15px rgba(18, 14, 13, 0.07)',
        'doppelrand-dark': '0 0 0 1px rgba(255, 255, 255, 0.1), 0 20px 40px -15px rgba(0, 0, 0, 0.5)',
      },
      transitionTimingFunction: {
        'premium': 'cubic-bezier(0.32, 0.72, 0, 1)',
        'expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        'scroll-bob': {
          '0%, 100%': { transform: 'translateY(0)', opacity: '0.6' },
          '50%': { transform: 'translateY(6px)', opacity: '1' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        'drift': {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(0,-3%,0) scale(1.05)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      animation: {
        'scroll-bob': 'scroll-bob 2s cubic-bezier(0.45, 0, 0.55, 1) infinite',
        'drift': 'drift 22s ease-in-out infinite',
        'float-slow': 'float-slow 6s ease-in-out infinite',
        'shimmer': 'shimmer 3s linear infinite',
      },
    },
  },
  plugins: [],
}
