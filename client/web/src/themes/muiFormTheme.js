import { createTheme } from '@mui/material/styles';

/**
 * One UI dark-mode contrast fix (2026-08-16 follow-up) — `PasswordField`
 * (and any other MUI form control) reused inside the authenticated
 * dashboard (`SecurityPage.jsx`'s "Change password" card) has no MUI
 * `ThemeProvider` above it there, unlike the auth pages, which are all
 * wrapped in `AuthLayout.jsx`'s `muiAuthTheme`. Without one, MUI falls
 * back to its own default light palette — dark, near-black label/input
 * text on a background that inherits the page's dark surface, which is
 * exactly the "text ... not all visible in the dark ... mode" report.
 *
 * `muiAuthTheme` isn't reusable here as-is: it hardcodes
 * `backgroundColor: '#fff'` for the input, correct for the
 * always-light branded auth screens but wrong the moment it's dark
 * mode. This theme instead points every color at the same Tailwind
 * CSS custom properties `index.css`'s `.dark` block already defines
 * (`--background`, `--foreground`, `--border`, `--muted-foreground`),
 * so it tracks whichever mode is actually active — light, dark, or
 * system — automatically, with no JS-side light/dark branching needed
 * and no risk of drifting from the token system FET-03 established.
 *
 * Every reference is wrapped `hsl(var(--x))`, not bare `var(--x)`:
 * `index.css` defines these tokens as raw HSL triplets (e.g.
 * `--background: 210 40% 98%`) for Tailwind's own `hsl(var(--x))`
 * color config, so a bare `var(--x)` resolves to an invalid CSS color
 * and silently falls back to `transparent`/`currentColor`. Now also
 * the theme `AuthLayout.jsx` uses (2026-08 auth-dedup follow-up),
 * replacing the removed `muiAuthTheme`.
 */
export const muiFormTheme = createTheme({
  palette: {
    primary: { main: '#0e7c86' },
    error: { main: '#dc2626' },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
  },
  components: {
    MuiTextField: {
      defaultProps: { variant: 'outlined', fullWidth: true },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 14,
          backgroundColor: 'hsl(var(--background))',
          color: 'hsl(var(--foreground))',
          minHeight: 56,
          '& fieldset': { borderColor: 'hsl(var(--border))' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'hsl(var(--muted-foreground))' },
        },
        input: {
          padding: '16px 14px',
          color: 'hsl(var(--foreground))',
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        root: { fontSize: '0.95rem', color: 'hsl(var(--muted-foreground))' },
      },
    },
    MuiFormHelperText: {
      styleOverrides: {
        root: { marginLeft: 4, fontSize: '0.8rem', color: 'hsl(var(--muted-foreground))' },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: { color: 'hsl(var(--muted-foreground))' },
      },
    },
  },
});
