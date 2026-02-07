/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        panel: "#0f172a",
        base: "#0b1220",
        accent: "#7c3aed"
      }
    }
  },
  plugins: []
};
