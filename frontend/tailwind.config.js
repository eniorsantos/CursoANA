/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        stream: { bg: "#1E1830", surface: "#2A2340", surface2: "#352C4D", surface3: "#453A5C", accent: "#9B5DE5", warm: "#D9B8FF", dim: "#B3A9C2" },
        admin: { bg: "#1E1830", muted: "#352C4D", border: "#453A5C", accent: "#9B5DE5", accentMuted: "#352C4D" },
      },
      fontFamily: { bebas: ['"Bebas Neue"', "sans-serif"], inter: ["Inter", "sans-serif"] },
    },
  },
  plugins: [],
};
