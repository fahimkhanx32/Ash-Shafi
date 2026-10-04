import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { CheckCircle2, XCircle, Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import * as authService from '../services/authService.js';
import { extractApiError } from '../services/apiClient.js';
import { buildForgotPasswordSchema } from '../schemas/authSchemas.js';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import { Button, buttonVariants } from '../components/ui/button.jsx';
import { Alert, AlertDescription } from '../components/ui/alert.jsx';
import { cn } from '../lib/utils.js';

/**
 * The "resend verification" sub-form shown when a verification link
 * has expired or was already used. Reuses `buildForgotPasswordSchema`
 * (same shape: a single required `identifier` field) rather than
 * defining an identical schema twice.
 */
function ResendVerificationForm() {
  const { t, i18n } = useTranslation();
  const [sent, setSent] = useState(false);

  const forgotPasswordSchema = useMemo(() => buildForgotPasswordSchema(t), [t, i18n.language]);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { identifier: '' },
  });

  if (sent) {
    return (
      <Alert variant="success" className="mt-4 text-left">
        <AlertDescription>{t('auth.verifyEmail.resendSentMessage')}</AlertDescription>
      </Alert>
    );
  }

  const onSubmit = async (values) => {
    try {
      await authService.resendVerification(values);
    } finally {
      // Backend response is deliberately enumeration-safe/generic
      // already — show the same confirmation regardless of outcome.
      setSent(true);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-4 w-full text-left">
      <div className="flex flex-col gap-3">
        <Controller
          name="identifier"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              size="small"
              label={t('auth.verifyEmail.resendIdentifierLabel')}
              autoComplete="username"
              error={Boolean(errors.identifier)}
              helperText={errors.identifier?.message}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Mail size={16} aria-hidden="true" />
                  </InputAdornment>
                ),
              }}
            />
          )}
        />
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {isSubmitting ? t('auth.verifyEmail.resendSubmitting') : t('auth.verifyEmail.resendSubmit')}
        </Button>
      </div>
    </form>
  );
}

export default function VerifyEmailPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [state, setState] = useState('verifying'); // verifying | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setState('error');
      setMessage(t('auth.verifyEmail.missingToken'));
      return;
    }
    let cancelled = false;
    authService
      .verifyEmail({ token })
      .then((result) => {
        if (cancelled) return;
        setState('success');
        setMessage(result.message || t('auth.verifyEmail.defaultSuccess'));
      })
      .catch((error) => {
        if (cancelled) return;
        setState('error');
        setMessage(extractApiError(error).message);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <AuthLayout title={t('auth.verifyEmail.title')} lightOnly>
      <div className="flex flex-col items-center text-center gap-4 py-2">
        {state === 'verifying' && (
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        )}
        {state === 'success' && <CheckCircle2 className="h-10 w-10 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />}
        {state === 'error' && <XCircle className="h-10 w-10 text-destructive" aria-hidden="true" />}
        <p className="text-sm text-muted-foreground">{message}</p>

        {state === 'success' ? (
          <Link to="/login" className={cn(buttonVariants({ size: 'lg' }), 'mt-2')}>
            {t('auth.verifyEmail.continueToSignIn')}
          </Link>
        ) : null}

        {state === 'error' ? (
          <>
            <ResendVerificationForm />
            <Link to="/login" className="text-sm font-medium text-primary hover:underline mt-1">
              {t('auth.verifyEmail.backToSignIn')}
            </Link>
          </>
        ) : null}
      </div>
    </AuthLayout>
  );
}
