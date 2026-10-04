import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

// Shared with SecurityPage's "Change password" card and
// RestoreBackupDialog (see muiFormTheme.js) — the app's one MUI
// theme for form controls, tracking Light/Dark/System via the same
// CSS custom properties `ThemeProvider.jsx`/`applyTheme.js` already
// maintain on `<html>`. The auth-only `muiAuthTheme` this replaced
// hardcoded a light-only palette and has been removed.
import { muiFormTheme } from '../../themes/muiFormTheme.js';

/**
 * Shared shell for every authentication screen (Login, Register,
 * Forgot/Reset password, Verify email). Mobile-first: single column,
 * comfortable padding, and a card that never forces horizontal
 * scroll down to a 320px viewport.
 *
 * The outer card itself is neumorphic (shadow-neu-lg, flat
 * `bg-background`, no border) to match the reskinned LoginForm/
 * RegisterForm — applied here rather than per-page since it's purely
 * the shell, not the individual fields, so every auth page picks it
 * up uniformly. The *inner* fields on Forgot/Reset/VerifyEmail still
 * use the original MUI `TextField`/`PasswordField.jsx` styling —
 * only Login/Register were reskinned to the new pill fields.
 *
 * `lightOnly`: applies `.force-light` (index.css) to pin every
 * themeable token to its plain light-mode value for this whole
 * subtree, ignoring whatever dark-mode/color-theme/text-color
 * preference is active on `<html>`. Passed by every auth page
 * (Login/Register/ForgotPassword/ResetPassword/VerifyEmail) — none of
 * these have a signed-in user yet to personalize for, and the
 * neumorphic pill fields on Login/Register were designed against one
 * fixed light surface with no dark-mode pass. Left as an explicit
 * per-page prop (not just always-on inside AuthLayout) so it's a
 * deliberate, visible choice at each call site rather than baked in
 * silently.
 */
export default function AuthLayout({ title, subtitle, children, footer, lightOnly = false }) {
  return (
    <ThemeProvider theme={muiFormTheme}>
      <CssBaseline />
      <div
        className={`min-h-screen w-full bg-gradient-to-b from-accent/40 to-background flex flex-col items-center justify-center px-4 py-8 sm:py-12 ${lightOnly ? 'force-light' : ''}`}
      >
        <div className="w-full max-w-[440px]">
          <div className="flex items-center justify-center gap-2 mb-6 sm:mb-8">
            <div className="h-10 w-10 rounded-2xl bg-primary text-primary-foreground grid place-items-center font-bold shadow-one-ui">
              A
            </div>
            <span className="text-lg font-semibold tracking-tight">Ash-Shāfī</span>
          </div>

          <div className="neu-surface rounded-[2rem] bg-background shadow-neu-lg p-6 sm:p-8">
            <div className="mb-6 text-center">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
              {subtitle ? <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p> : null}
            </div>

            {children}
          </div>

          {footer ? <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </div>
    </ThemeProvider>
  );
}
