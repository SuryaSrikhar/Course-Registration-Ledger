/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Plus Jakarta Sans'", "sans-serif"]
      },
      colors: {
        brand: {
          deep: "#071129",
          cyan: "#39d0ff",
          lime: "#a8ff78",
          peach: "#ffb570"
        }
      },
      boxShadow: {
        glass: "0 10px 35px rgba(6, 13, 31, 0.28)"
      },
      animation: {
        drift: "drift 10s ease-in-out infinite"
      },
      keyframes: {
        drift: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-14px)" }
        }
      }
    }
  },
  plugins: []
};
