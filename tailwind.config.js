/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/**/*.{html,js}",
  ],
  theme: {
    extend: {
      animation: {
        'pulse-slow': 'pulse 2s infinite',
      }
    },
  },
  plugins: [],
}
