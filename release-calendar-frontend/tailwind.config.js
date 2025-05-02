/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Purples
        'purple-primary': '#7e22ce',  // purple-700
        'purple-dark':    '#5b21b6',  // purple-800

        // Blacks / grays
        'black-bg':   '#000000',
        'gray-bg':    '#1f1f1f',
        'gray-panel': '#2e2e2e',
      }
    },
  },
  plugins: [],
}

