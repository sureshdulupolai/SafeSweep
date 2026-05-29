/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src-ui/index.html",
    "./src-ui/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          darkest: "#070A13",  // Raycast/Linear style deep background
          dark: "#0B0F19",     // Main panels background
          card: "#121824",     // Widgets/cards
          border: "#1E293B",   // Neutral borders
          accent: "#2A7BEF",   // Primary Ocean Blue
          green: "#10B981",    // Safe green
          amber: "#F59E0B",    // Warning orange
          rose: "#EF4444",     // Danger red
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
}
