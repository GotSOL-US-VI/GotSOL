import type {Config} from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mint: '#89f8cb',
        lavender: '#dac0ff',
        'light-blue': '#a5dae0',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [require('daisyui')],
  daisyui: {
    themes: [
      {
        dark: {
          ...require('daisyui/src/theming/themes')['dark'],
          primary: '#89f8cb',
          secondary: '#dac0ff',
          accent: '#a5dae0',
          "base-100": "#000000",
          "base-200": "rgba(255, 255, 255, 0.05)",
          "base-300": "rgba(255, 255, 255, 0.1)",
          neutral: "#1a1a1a",
          "neutral-content": "#ffffff",
          "primary-content": "#000000",
          "secondary-content": "#000000",
          "accent-content": "#000000",
        },
        light: {
          ...require('daisyui/src/theming/themes')['light'],
          primary: '#89f8cb',
          secondary: '#dac0ff',
          accent: '#a5dae0',
          "base-100": "#ffffff",
          "base-200": "#f8f9fa",
          "base-300": "#f1f3f5",
          neutral: "#f1f3f5",
          "neutral-content": "#000000",
        },
      },
    ],
  },
};
export default config;
