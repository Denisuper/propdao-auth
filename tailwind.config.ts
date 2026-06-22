import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#92a872',
          light: '#a3b884',
          dark: '#7d9060',
        },
        secondary: {
          DEFAULT: '#F5F5DC',
          dark: '#E8E8CE',
        },
        text: {
          primary: '#2C3E1F',
          secondary: '#8B8B7A',
        },
        border: '#D4D4C0',
        background: '#fdfdfb',
      },
    },
  },
  plugins: [],
}

export default config
