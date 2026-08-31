/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Flores El Trigal — Azul Trigal ("Confianza"). Used as the app's
        // primary brand color (navbars, headers, primary actions).
        primary: {
          DEFAULT: '#1F3361',
          dark: '#14223F',
          light: '#263E6E',
          pale: '#DCE2F0',
          50: '#EEF1F8',
          100: '#DCE2F0',
          200: '#C4CEE3',
          300: '#6B7CA8',
          400: '#3A5390',
          500: '#263E6E',
          600: '#1F3361',
          700: '#1A2B52',
          800: '#14223F',
          900: '#0F1A30',
          950: '#0A1220',
        },
        // Amarillo Trigal ("Abundancia") — accent for CTAs, highlights, focus rings.
        accent: {
          DEFAULT: '#FFD40A',
          100: '#FFF6CF',
          200: '#FFEC8A',
          500: '#FFD40A',
          600: '#E6BD00',
          700: '#C9A700',
        },
        exito: '#2F9E5B',
        aviso: '#E6BD00',
        error: '#D6453B',
      },
      fontFamily: {
        sans: ['Montserrat', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '18px',
        '2xl': '28px',
      },
      boxShadow: {
        brand: '0 8px 20px rgba(31, 51, 97, 0.10)',
        accent: '0 8px 22px rgba(255, 212, 10, 0.35)',
      },
    },
  },
  plugins: [],
};
