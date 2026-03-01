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
        background: '#0a0a0f',
        surface: '#12121c',
        'surface-light': '#1c1c2a',
        'surface-glass': 'rgba(18, 18, 28, 0.6)',
        foreground: '#f0f0f5',
        muted: '#8888a0',
        border: '#2a2a3a',
        green: {
          DEFAULT: '#16a34a',
          dark: '#15803d',
          muted: '#14532d',
          vivid: '#22c55e',
        },
        purple: {
          DEFAULT: '#9333ea',
          dark: '#7e22ce',
          muted: '#581c87',
        },
        orange: {
          DEFAULT: '#ea580c',
          dark: '#c2410c',
          muted: '#9a3412',
        },
        cyan: {
          DEFAULT: '#06b6d4',
          dark: '#0891b2',
          muted: '#164e63',
          vivid: '#22d3ee',
        },
      },
      fontFamily: {
        heading: ['var(--font-syne)', 'sans-serif'],
        body: ['var(--font-figtree)', 'sans-serif'],
        mono: ['var(--font-ibm-plex-mono)', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(22, 163, 74, 0.15)',
        'glow-lg': '0 0 40px rgba(34, 197, 94, 0.2), 0 0 80px rgba(34, 197, 94, 0.1)',
        'glow-purple': '0 0 20px rgba(147, 51, 234, 0.15)',
        'glow-orange': '0 0 20px rgba(234, 88, 12, 0.15)',
        'glow-cyan': '0 0 20px rgba(6, 182, 212, 0.15)',
        'inner-glow': 'inset 0 1px 0 rgba(255, 255, 255, 0.05)',
      },
      backgroundImage: {
        'mesh-1': 'radial-gradient(at 20% 30%, rgba(20, 83, 45, 0.15) 0%, transparent 50%)',
        'mesh-2': 'radial-gradient(at 80% 20%, rgba(88, 28, 135, 0.1) 0%, transparent 50%)',
        'mesh-3': 'radial-gradient(at 50% 80%, rgba(22, 163, 74, 0.08) 0%, transparent 50%)',
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
          '0%, 100%': { boxShadow: '0 0 20px rgba(34, 197, 94, 0.15)' },
          '50%': { boxShadow: '0 0 40px rgba(34, 197, 94, 0.3), 0 0 80px rgba(34, 197, 94, 0.1)' },
        },
        'line-draw': {
          '0%': { strokeDashoffset: '100' },
          '100%': { strokeDashoffset: '0' },
        },
        'scan-beam': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-node': {
          '0%, 100%': { r: '3', opacity: '0.6' },
          '50%': { r: '5', opacity: '1' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.6s ease-out forwards',
        'gradient-shift': 'gradient-shift 8s ease infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        'line-draw': 'line-draw 2s ease-out forwards',
        'scan-beam': 'scan-beam 3s ease-in-out infinite',
        'pulse-node': 'pulse-node 2s ease-in-out infinite',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
