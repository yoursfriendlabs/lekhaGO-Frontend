const rgb = (channel) => `rgb(var(${channel}) / <alpha-value>)`;

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
        sans: ['var(--font-sans)', '"IBM Plex Sans"', '"IBM Plex Sans Devanagari"', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Outfit', 'sans-serif'],
      },
      colors: {
        primary: {
          DEFAULT: rgb('--color-primary'),
          50: rgb('--color-primary-50'),
          100: rgb('--color-primary-100'),
          200: rgb('--color-primary-200'),
          300: rgb('--color-primary-300'),
          400: rgb('--color-primary-400'),
          500: rgb('--color-primary-500'),
          600: rgb('--color-primary-600'),
          700: rgb('--color-primary-700'),
          800: rgb('--color-primary-800'),
          900: rgb('--color-primary-900'),
        },
        secondary: {
          DEFAULT: rgb('--color-secondary'),
          50: rgb('--color-secondary-50'),
          100: rgb('--color-secondary-100'),
          200: rgb('--color-secondary-200'),
          300: rgb('--color-secondary-300'),
          400: rgb('--color-secondary-400'),
          500: rgb('--color-secondary-500'),
          600: rgb('--color-secondary-600'),
          700: rgb('--color-secondary-700'),
          800: rgb('--color-secondary-800'),
          900: rgb('--color-secondary-900'),
        },
        ink: {
          DEFAULT: rgb('--color-ink'),
          light: rgb('--color-ink-light'),
        },
        mist: rgb('--color-mist'),
        surface: rgb('--color-surface'),
        ocean: rgb('--color-primary'),
        coral: rgb('--color-secondary'),
        sunrise: rgb('--color-primary-400'),
      },
      boxShadow: {
        soft: '0 20px 40px -25px rgb(var(--color-primary) / 0.35)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
