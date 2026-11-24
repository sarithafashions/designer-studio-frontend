/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          maroon: '#7B1123',
          'maroon-hover': '#5F0C1A',
          'rose-gold': '#D48B8B',
          gold: '#D4AF37',
          champagne: '#F8F3ED',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F8FAFC',
          subtle: '#F1F5F9',
        },
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['Jost', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
