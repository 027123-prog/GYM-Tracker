/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Space Grotesk', 'Segoe UI', 'sans-serif'],
        display: ['Sora', 'Space Grotesk', 'Segoe UI', 'sans-serif'],
      },
      colors: {
        ink: '#13221f',
        paper: '#f7f3e9',
        sunrise: '#f2aa6b',
        ember: '#d56345',
        sage: '#8fb7a4',
        pine: '#1f5c4f',
        mist: '#dce8e0',
      },
      boxShadow: {
        panel: '0 18px 45px rgba(19, 34, 31, 0.12)',
      },
      keyframes: {
        flash: {
          '0%': { transform: 'scale(0.98)', opacity: '0.6' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
      animation: {
        flash: 'flash 0.45s ease-out',
      },
    },
  },
  plugins: [],
};
