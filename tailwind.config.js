/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/UI/**/*.{js,ts,jsx,tsx}",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Configuration moved to @theme in index.css (Tailwind v4)
    },
  },
  plugins: [],
}