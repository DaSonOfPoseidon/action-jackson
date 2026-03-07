import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0f0f23',
        surface: '#1a1a2e',
        'surface-light': '#2a2a40',
        'surface-glass': 'rgba(26, 26, 46, 0.6)',
        foreground: '#f0f0f5',
        muted: '#8888a0',
        border: '#2a2a3a',
        purple: {
          DEFAULT: '#c084fc',
          dark: '#a855f7',
          muted: '#581c87',
          vivid: '#d8b4fe',
        },
        green: {
          DEFAULT: '#86efac',
          dark: '#4ade80',
          muted: '#14532d',
        },
        pink: {
          DEFAULT: '#fb7185',
          dark: '#f43f5e',
          muted: '#881337',
        },
        cyan: {
          DEFAULT: '#22d3ee',
          dark: '#06b6d4',
          muted: '#164e63',
        },
      },
      fontFamily: {
        heading: ['var(--font-syne)', 'sans-serif'],
        body: ['var(--font-figtree)', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(192, 132, 252, 0.15)',
        'glow-lg': '0 0 40px rgba(192, 132, 252, 0.2), 0 0 80px rgba(192, 132, 252, 0.1)',
        'glow-pink': '0 0 20px rgba(251, 113, 133, 0.15)',
        'glow-green': '0 0 20px rgba(134, 239, 172, 0.15)',
        'glow-cyan': '0 0 20px rgba(34, 211, 238, 0.15)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      },
      backgroundImage: {
        'mesh-1': 'radial-gradient(at 20% 30%, rgba(88, 28, 135, 0.15) 0%, transparent 50%)',
        'mesh-2': 'radial-gradient(at 80% 20%, rgba(251, 113, 133, 0.08) 0%, transparent 50%)',
        'mesh-3': 'radial-gradient(at 50% 80%, rgba(192, 132, 252, 0.08) 0%, transparent 50%)',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'gradient-shift': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(192, 132, 252, 0.15)' },
          '50%': { boxShadow: '0 0 40px rgba(192, 132, 252, 0.3), 0 0 80px rgba(192, 132, 252, 0.1)' },
        },
        'terminal-blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.6s ease-out forwards',
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'terminal-blink': 'terminal-blink 1s step-end infinite',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
