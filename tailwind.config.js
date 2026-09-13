/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base: "#0d1117",
        panel: "#161b22",
        border: "#30363d",
        // Accent lewat CSS variable (bukan hex statis) biar bisa direcolor
        // runtime tanpa rebuild — dipakai buat tema merah-putih pas Event
        // Kemerdekaan aktif (lihat --accent-rgb & .event-theme di globals.css,
        // di-toggle dari components/EventStatusProvider.tsx). Format
        // "rgb(var(...) / <alpha-value>)" ini yang bikin bg-accent/20,
        // text-accent/70, dst (opacity modifier Tailwind) tetap jalan normal.
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",
      },
      screens: {
        xs: "420px",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
