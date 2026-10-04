import { useTranslation } from 'react-i18next';
import AuthLayout from '../components/auth/AuthLayout.jsx';
import ForgotPasswordForm from '../components/auth/ForgotPasswordForm.jsx';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  return (
    <AuthLayout title={t('auth.forgotPassword.title')} subtitle={t('auth.forgotPassword.subtitle')} lightOnly>
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
