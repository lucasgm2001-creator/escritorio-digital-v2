import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // DR Growth brand (sidebar / brand elements)
        brand: {
          DEFAULT: '#0f2044',
          50:  '#e8edf5',
          100: '#c5d0e5',
          200: '#9eb0d3',
          300: '#7690c0',
          400: '#5578b2',
          500: '#3560a4',
          600: '#2a4f8f',
          700: '#1f3d77',
          800: '#152c5f',
          900: '#0f2044',
          950: '#09152d',
        },
        // Interactive primary — indigo/blue accent
        primary: {
          DEFAULT: '#6366f1',
          50:  '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        secondary: {
          DEFAULT: '#8b5cf6',
          foreground: '#ffffff',
        },
        // Dark theme surface tokens
        background: '#0d1117',
        foreground: '#e6edf3',
        muted: {
          DEFAULT: '#161b22',
          foreground: '#7d8590',
        },
        border: '#2d3748',
        input: '#2d3748',
        ring: '#6366f1',
        card: {
          DEFAULT: '#161b22',
          foreground: '#e6edf3',
        },
        popover: {
          DEFAULT: '#1e2533',
          foreground: '#e6edf3',
        },
        // Status colors
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#ffffff',
        },
        success: {
          DEFAULT: '#22c55e',
          foreground: '#ffffff',
        },
        warning: {
          DEFAULT: '#f59e0b',
          foreground: '#ffffff',
        },
        accent: {
          DEFAULT: '#1e2533',
          foreground: '#e6edf3',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.375rem',
      },
      boxShadow: {
        card:        '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'card-hover':'0 4px 16px rgba(0,0,0,0.5), 0 2px 6px rgba(0,0,0,0.3)',
        glow:        '0 0 20px rgba(99,102,241,0.25)',
        'glow-sm':   '0 0 10px rgba(99,102,241,0.15)',
      },
      backgroundImage: {
        'gradient-card':    'linear-gradient(135deg, #161b22 0%, #1a2233 100%)',
        'gradient-sidebar': 'linear-gradient(180deg, #0d1520 0%, #0a1018 100%)',
        'gradient-hero':    'linear-gradient(135deg, #0d1117 0%, #161b22 50%, #1a2033 100%)',
      },
      animation: {
        'fade-in':    'fadeIn 0.2s ease-out',
        'slide-up':   'slideUp 0.25s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}

export default config
