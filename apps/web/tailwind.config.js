/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ward: {
          overdue: "#EF4444",
          "overdue-bg": "#FEF2F2",
          "overdue-border": "#FECACA",
          due: "#3B82F6",
          "due-bg": "#EFF6FF",
          "due-border": "#BFDBFE",
          soon: "#F59E0B",
          "soon-bg": "#FFFBEB",
          "soon-border": "#FDE68A",
          later: "#6B7280",
          "later-bg": "#F9FAFB",
          teal: "#0D9488",
          "teal-light": "#CCFBF1",
          surface: "#F8FAFC",
          card: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Inter", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
        "card-hover": "0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)",
        modal: "0 20px 60px rgba(0,0,0,0.15)",
      },
    },
  },
  plugins: [],
};
