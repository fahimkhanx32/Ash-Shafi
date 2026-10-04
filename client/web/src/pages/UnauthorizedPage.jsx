import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/ui/button.jsx';

export default function UnauthorizedPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen grid place-items-center px-4 text-center">
      <div className="flex flex-col items-center gap-4 max-w-sm">
        <ShieldAlert className="h-10 w-10 text-destructive" aria-hidden="true" />
        <h1 className="text-xl font-bold">{t('errors.unauthorizedTitle')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('errors.unauthorizedDescription')}
        </p>
        <Button onClick={() => window.history.back()} variant="outline">
          {t('common.goBack')}
        </Button>
        <Link to="/dashboard" className="text-sm font-medium text-primary hover:underline">
          {t('errors.returnToDashboard')}
        </Link>
      </div>
    </div>
  );
}
