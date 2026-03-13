/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        serif: ['"Fraunces"', 'serif'],
      },
      colors: {
        ink: '#0f172a',
        mist: '#eef2ff',
        ocean: '#0ea5a4',
        coral: '#fb7185',
        sunrise: '#f59e0b',
      },
      boxShadow: {
        soft: '0 20px 40px -25px rgba(15, 23, 42, 0.35)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
