/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./blog/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["var(--font-roboto-mono)"],
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            color: theme("colors.gray.700"),
            h1: {
              fontFamily: ["var(--font-roboto-mono)"],
            },
            h2: {
              fontFamily: ["var(--font-roboto-mono)"],
            },
            h3: {
              fontFamily: ["var(--font-roboto-mono)"],
            },
            h4: {
              fontFamily: ["var(--font-roboto-mono)"],
            },
          },
        },
      }),
    },
  },
  plugins: [require("@tailwindcss/typography")],
};
