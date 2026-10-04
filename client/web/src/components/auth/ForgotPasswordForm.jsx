import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { Mail } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import * as authService from '../../services/authService.js';
import { extractApiError } from '../../services/apiClient.js';
import { buildForgotPasswordSchema } from '../../schemas/authSchemas.js';
import { Button } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import FormError from './FormError.jsx';

export default function ForgotPasswordForm() {
  const { t, i18n } = useTranslation();
  const [serverError, setServerError] = useState('');
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

  const onSubmit = async (values) => {
    setServerError('');
    try {
      const result = await authService.forgotPassword(values);
      setSent(true);
      // Backend response is deliberately enumeration-safe/generic already.
      void result;
    } catch (error) {
      setServerError(extractApiError(error).message);
    }
  };

  if (sent) {
    return (
      <Alert variant="success">
        <AlertDescription>{t('auth.forgotPassword.sentMessage')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormError message={serverError} />
      <div className="flex flex-col gap-5">
        <Controller
          name="identifier"
          control={control}
          render={({ field }) => (
            <TextField
              {...field}
              label={t('auth.forgotPassword.identifierLabel')}
              autoComplete="username"
              autoFocus
              error={Boolean(errors.identifier)}
              helperText={errors.identifier?.message}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Mail size={18} aria-hidden="true" />
                  </InputAdornment>
                ),
              }}
            />
          )}
        />

        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? t('auth.forgotPassword.submitting') : t('auth.forgotPassword.submit')}
        </Button>
      </div>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link to="/login" className="font-medium text-primary hover:underline">
          {t('auth.forgotPassword.backToSignIn')}
        </Link>
      </p>
    </form>
  );
}
