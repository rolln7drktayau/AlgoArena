/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        panel: "rgb(var(--panel) / <alpha-value>)",
        ink: "rgb(var(--ink) / <alpha-value>)",
        card: "rgb(var(--card) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        ember: "rgb(var(--ember) / <alpha-value>)",
        ice: "rgb(var(--ice) / <alpha-value>)",
        slate: "rgb(var(--slate) / <alpha-value>)",
        stroke: "rgb(var(--stroke) / <alpha-value>)"
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(41,219,166,0.25), 0 18px 45px rgba(0,0,0,0.45)"
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"]
      }
    }
  },
  plugins: []
};
