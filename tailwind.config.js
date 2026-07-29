/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'sans-serif'],
        display: ['Bahnschrift', 'Inter', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        ink: '#F2F1EF',
        paper: '#191919',
        surface: '#222222',
        'surface-raised': '#2D2D2D',
        line: '#3A3A3A',
        muted: '#AAA6A2',
        amber: '#F47A24',
        'amber-dark': '#D96216',
        'amber-deep': '#FF9A55',
        'amber-soft': '#3A291F',
        ember: '#EF6A72',
        sage: '#73B991',
        pine: '#73B991',
        mist: '#26342C',
      },
      boxShadow: {
        panel: '0 12px 30px rgba(0, 0, 0, 0.16)',
        glow: '0 0 0 1px rgba(244, 122, 36, 0.3), 0 10px 28px rgba(244, 122, 36, 0.1)',
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
