/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          dark: '#0b1221',
          DEFAULT: '#0f172a',
          light: '#1e293b'
        },
        accent: {
          pink: '#ff48c4',
          cyan: '#57c5c8',
          purple: '#8b00ff'
        }
      }
    },
  },
  plugins: [],
}
