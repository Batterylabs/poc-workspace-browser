/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{svelte,js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      screens: {
        // Custom 'xs' breakpoint for very narrow phones (360px)
        xs: '360px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
