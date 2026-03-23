/** @type {import('tailwindcss').Config} */
export default {
  // Disable automatic OS-based dark mode. We don't use a dark theme in this app.
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
        primary: {
          DEFAULT: '#9b6835',
          50: '#fcfaf8',
          100: '#f7f2ed',
          200: '#ede0d1',
          300: '#dec7af',
          400: '#c7a382',
          500: '#9b6835',
          600: '#8c5e30',
          700: '#754e28',
          800: '#5e3e20',
          900: '#4d331a',
        },
        secondary: {
          DEFAULT: '#a57749',
          50: '#fbf9f7',
          100: '#f6f1ec',
          200: '#e9dbcf',
          300: '#d7bcab',
          400: '#bc9680',
          500: '#a57749',
          600: '#956b42',
          700: '#7c5937',
          800: '#63472c',
          900: '#513a24',
        },
        ink: {
          DEFAULT: '#1a140f',
          light: '#4d331a',
        },
        mist: '#f7f2ed',
        ocean: '#9b6835',
        coral: '#a57749',
        sunrise: '#c7a382',
      },
      boxShadow: {
        soft: '0 20px 40px -25px rgba(155, 104, 53, 0.35)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
