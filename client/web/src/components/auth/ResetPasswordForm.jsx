import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import * as authService from '../../services/authService.js';
import { extractApiError } from '../../services/apiClient.js';
import { buildResetPasswordSchema } from '../../schemas/authSchemas.js';
import { Button } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import PasswordField from './PasswordField.jsx';
import FormError from './FormError.jsx';

export default function ResetPasswordForm() {
  const { t, i18n } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const resetPasswordSchema = useMemo(() => buildResetPasswordSchema(t), [t, i18n.language]);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  if (!token) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          {t('auth.resetPassword.invalidLink')}{' '}
          <Link to="/forgot-password" className="font-medium underline">
            {t('auth.resetPassword.forgotPasswordLink')}
          </Link>{' '}
          {t('auth.resetPassword.page')}
        </AlertDescription>
      </Alert>
    );
  }

  const onSubmit = async (values) => {
    setServerError('');
    try {
      const result = await authService.resetPassword({ token, newPassword: values.newPassword });
      setSuccessMessage(result.message || t('auth.resetPassword.defaultSuccess'));
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (error) {
      setServerError(extractApiError(error).message);
    }
  };

  if (successMessage) {
    return (
      <Alert variant="success">
        <AlertDescription>{successMessage}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <FormError message={serverError} />
      <div className="flex flex-col gap-5">
        <Controller
          name="newPassword"
          control={control}
          render={({ field }) => (
            <PasswordField
              {...field}
              label={t('auth.resetPassword.newPasswordLabel')}
              autoComplete="new-password"
              autoFocus
              error={Boolean(errors.newPassword)}
              helperText={
                errors.newPassword?.message
                || t('auth.resetPassword.passwordHelper')
              }
            />
          )}
        />
        <Controller
          name="confirmPassword"
          control={control}
          render={({ field }) => (
            <PasswordField
              {...field}
              label={t('auth.resetPassword.confirmNewPasswordLabel')}
              autoComplete="new-password"
              error={Boolean(errors.confirmPassword)}
              helperText={errors.confirmPassword?.message}
            />
          )}
        />
        <Button type="submit" size="lg" disabled={isSubmitting}>
          {isSubmitting ? t('auth.resetPassword.submitting') : t('auth.resetPassword.submit')}
        </Button>
      </div>
    </form>
  );
}
