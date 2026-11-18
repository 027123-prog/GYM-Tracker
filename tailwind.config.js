/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-body)'],
        display: ['var(--font-display)'],
      },
      colors: {
        ink: 'rgb(var(--ink) / <alpha-value>)',
        paper: 'rgb(var(--paper) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-raised': 'rgb(var(--raised) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        amber: 'rgb(var(--accent) / <alpha-value>)',
        'amber-dark': 'rgb(var(--accent-dark) / <alpha-value>)',
        'amber-deep': 'rgb(var(--accent-text) / <alpha-value>)',
        'amber-soft': 'rgb(var(--accent-soft) / <alpha-value>)',
        'on-accent': 'rgb(var(--on-accent) / <alpha-value>)',
        ember: 'rgb(var(--danger) / <alpha-value>)',
        sage: 'rgb(var(--success) / <alpha-value>)',
        pine: 'rgb(var(--success) / <alpha-value>)',
        mist: 'rgb(var(--success-soft) / <alpha-value>)',
      },
      boxShadow: {
        panel: 'var(--panel-shadow)',
        glow: '0 0 0 1px rgb(var(--accent) / .3), 0 10px 28px rgb(var(--accent) / .1)',
      },
      keyframes: {
        flash: {
          '0%': { transform: 'scale(0.98)', opacity: '0.6' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        flash: 'flash 0.28s ease-out',
      },
    },
  },
  plugins: [],
};
