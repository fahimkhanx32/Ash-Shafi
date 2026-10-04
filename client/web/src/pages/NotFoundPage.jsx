import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen grid place-items-center px-4 text-center">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-4xl font-bold text-primary">{t('errors.notFoundTitle')}</h1>
        <p className="text-muted-foreground">{t('errors.notFoundDescription')}</p>
        <Link to="/" className="text-sm font-medium text-primary hover:underline">
          {t('common.goHome')}
        </Link>
      </div>
    </div>
  );
}
