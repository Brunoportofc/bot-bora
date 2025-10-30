import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
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
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Cores customizadas do projeto
        'dark-navy': {
          DEFAULT: '#0f1932',
          '950': 'hsl(218, 54%, 4%)',
        },
        'mint-glow': {
          DEFAULT: '#75d3af',
          '50': '#f0fdf9',
          '100': '#ccfdf0',
          '200': '#99f6e0',
          '300': '#5de9cb',
          '400': '#22d3aa',
          '500': '#75d3af',
          '600': '#059669',
          '700': '#047857',
          '800': '#065f46',
          '900': '#064e3b',
        },
        'bora-blue': {
          DEFAULT: '#243B6B',
          '50': '#f1f4f9',
          '100': '#e3e9f3',
          '200': '#c7d3e7',
          '300': '#9fb3d5',
          '400': '#708dc0',
          '500': '#4f6bab',
          '600': '#3d5490',
          '700': '#243B6B',
          '800': '#2a3a5c',
          '900': '#26334e',
        },
        'bora-red': {
          DEFAULT: '#E31E24',
          '50': '#fef2f2',
          '100': '#fee2e2',
          '200': '#fecaca',
          '300': '#fca5a5',
          '400': '#f87171',
          '500': '#ef4444',
          '600': '#E31E24',
          '700': '#b91c1c',
          '800': '#991b1b',
          '900': '#7f1d1d',
        },
        'bora-yellow': {
          DEFAULT: '#FFD700',
          '50': '#fffbeb',
          '100': '#fef3c7',
          '200': '#fde68a',
          '300': '#fcd34d',
          '400': '#fbbf24',
          '500': '#f59e0b',
          '600': '#FFD700',
          '700': '#a16207',
          '800': '#854d0e',
          '900': '#713f12',
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "fade-out-scale": {
          "0%": { opacity: "1", transform: "scale(1) translateY(0)" },
          "100%": { opacity: "0", transform: "scale(0.8) translateY(-10px)" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "custom-bounce": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
        "fade-out-scale": "fade-out-scale 0.5s ease-out forwards",
        "float": "float 6s ease-in-out infinite",
        "custom-bounce": "custom-bounce 1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;

export default config;