import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        frost: {
          bg: "#080b17",
          panel: "rgba(255,255,255,0.08)",
          line: "rgba(255,255,255,0.09)",
          accent: "#5da6ff",
          accentSoft: "#8a8dff",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(125, 186, 255, 0.18), 0 24px 80px rgba(69, 123, 255, 0.14)",
      },
      backdropBlur: {
        xl: "20px",
      },
      fontFamily: {
        display: ["Outfit", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;

