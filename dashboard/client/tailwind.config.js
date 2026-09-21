/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cyan: { DEFAULT: '#00d4ff', dim: '#0099bb' },
        purple: { DEFAULT: '#7c3aed', dim: '#5b21b6' },
        bg: '#0a0e1a',
        surface: 'rgba(255,255,255,0.03)',
        border: 'rgba(0,212,255,0.15)',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
