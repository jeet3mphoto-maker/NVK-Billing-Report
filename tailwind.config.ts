import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#003887",
          foreground: "#ffffff",
          50: "#e6eef8",
          100: "#c0d4ee",
          200: "#96b7e3",
          300: "#6b9ad8",
          400: "#4d84d1",
          500: "#2e6eca",
          600: "#2963bc",
          700: "#2255aa",
          800: "#1b4798",
          900: "#003887",
        },
        secondary: {
          DEFAULT: "#A6A6A6",
          foreground: "#ffffff",
          50: "#f5f5f5",
          100: "#e9e9e9",
          200: "#d9d9d9",
          300: "#c4c4c4",
          400: "#a6a6a6",
          500: "#8d8d8d",
          600: "#7a7a7a",
          700: "#676767",
          800: "#545454",
          900: "#3d3d3d",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        asa: {
          blue: "#003887",
          gray: "#A6A6A6",
          white: "#FFFFFF",
          "blue-light": "#1a4fa3",
          "blue-dark": "#002a6b",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
