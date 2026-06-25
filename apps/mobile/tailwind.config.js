const path = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.resolve(__dirname, "./App.tsx").replace(/\\/g, "/"),
    path.resolve(__dirname, "./src/**/*.{js,jsx,ts,tsx}").replace(/\\/g, "/"),
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Calming brand color palette
        brand: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
        }
      }
    },
  },
  plugins: [],
}
