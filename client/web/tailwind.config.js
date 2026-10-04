/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    container: {
      center: true,
      padding: '1rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 4px)',
      },
      boxShadow: {
        'one-ui': '0 1px 2px rgba(16,24,40,0.04), 0 8px 24px -8px rgba(16,24,40,0.10)',
        'one-ui-lg': '0 2px 4px rgba(16,24,40,0.04), 0 16px 40px -12px rgba(16,24,40,0.14)',
        /* Soft-UI / neumorphic auth screens (LoginForm/RegisterForm +
           AuthLayout's card). Dual light/dark shadow off a single flat
           surface color, driven by --neu-shadow-light/-dark so it
           re-tunes itself for dark mode instead of hardcoding values
           that would go muddy or invisible when `.dark` is active. */
        neu: '7px 7px 14px hsl(var(--neu-shadow-dark)), -7px -7px 14px hsl(var(--neu-shadow-light))',
        'neu-sm': '4px 4px 8px hsl(var(--neu-shadow-dark)), -4px -4px 8px hsl(var(--neu-shadow-light))',
        'neu-lg': '10px 10px 24px hsl(var(--neu-shadow-dark)), -10px -10px 24px hsl(var(--neu-shadow-light))',
        'neu-inset': 'inset 4px 4px 8px hsl(var(--neu-shadow-dark)), inset -4px -4px 8px hsl(var(--neu-shadow-light))',
        'neu-inset-sm': 'inset 2px 2px 5px hsl(var(--neu-shadow-dark)), inset -2px -2px 5px hsl(var(--neu-shadow-light))',
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
