import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Five brand hues. The numbered shades are alpha ramps of the same
        // ink, never new colours.
        paper: {
          DEFAULT: 'var(--paper)',
          70: 'var(--paper-70)',
          60: 'var(--paper-60)',
          15: 'var(--paper-15)',
          12: 'var(--paper-12)',
        },
        kraft: {
          DEFAULT: 'var(--kraft)',
          60: 'var(--kraft-60)',
          30: 'var(--kraft-30)',
          12: 'var(--kraft-12)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          90: 'var(--ink-90)',
          70: 'var(--ink-70)',
          55: 'var(--ink-55)',
          40: 'var(--ink-40)',
          24: 'var(--ink-24)',
          12: 'var(--ink-12)',
          '06': 'var(--ink-06)',
        },
        vermilion: 'var(--vermilion)',
        moss: 'var(--moss)',
      },
      fontFamily: {
        display: ['var(--font-display)', 'Georgia', 'serif'],
        sans: ['var(--font-body)', 'Helvetica Neue', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Fluid editorial scale. clamp-based so headlines breathe at every width.
        'display-xl': ['clamp(2.8rem, 7.6vw, 8.5rem)', { lineHeight: '0.88', letterSpacing: '-0.03em' }],
        'display-lg': ['clamp(2.6rem, 8.2vw, 7.5rem)', { lineHeight: '0.9', letterSpacing: '-0.025em' }],
        'display-md': ['clamp(2rem, 5vw, 4.25rem)', { lineHeight: '0.98', letterSpacing: '-0.02em' }],
        'display-sm': ['clamp(1.5rem, 2.9vw, 2.6rem)', { lineHeight: '1.05', letterSpacing: '-0.015em' }],
        micro: ['0.6875rem', { lineHeight: '1.1', letterSpacing: '0.16em' }],
        nano: ['0.625rem', { lineHeight: '1.1', letterSpacing: '0.2em' }],
      },
      maxWidth: {
        prose: '36rem',
        column: '27rem',
      },
      spacing: {
        gutter: 'clamp(1.25rem, 5vw, 5.5rem)',
        'section-y': 'clamp(4.5rem, 11vh, 10rem)',
      },
      transitionTimingFunction: {
        paper: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'marquee-left': {
          '0%': { transform: 'translate3d(0,0,0)' },
          '100%': { transform: 'translate3d(-50%,0,0)' },
        },
        'fold-in': {
          '0%': { opacity: '0', transform: 'perspective(600px) rotateX(-14deg) translateY(14px)' },
          '100%': { opacity: '1', transform: 'perspective(600px) rotateX(0) translateY(0)' },
        },
      },
      animation: {
        'marquee-left': 'marquee-left 38s linear infinite',
        'fold-in': 'fold-in 0.8s cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;