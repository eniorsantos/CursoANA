/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        stream: { bg: "#1E1830", surface: "#2A2340", surface2: "#352C4D", surface3: "#453A5C", accent: "#9B5DE5", warm: "#D9B8FF", dim: "#B3A9C2" },
        admin: { bg: "#FAFAF9", muted: "#F2F1EF", border: "#E5E3E0", accent: "#6D4FC7", accentMuted: "#EDE9FB" },
      },
      fontFamily: { bebas: ['"Bebas Neue"', "sans-serif"], inter: ["Inter", "sans-serif"] },
    },
  },
  plugins: [],
};
