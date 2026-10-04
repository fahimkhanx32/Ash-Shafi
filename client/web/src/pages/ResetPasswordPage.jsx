import { useTranslation } from 'react-i18next';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import ResetPasswordForm from '../components/auth/ResetPasswordForm.jsx';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  return (
    <AuthLayout title={t('auth.resetPassword.title')} subtitle={t('auth.resetPassword.subtitle')} lightOnly>
      <ResetPasswordForm />
    </AuthLayout>
  );
}
