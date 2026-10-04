import { useTranslation } from 'react-i18next';

import { useAuth } from '../providers/AuthProvider.jsx';
import { Card, CardContent } from '../components/ui/card.jsx';
import { PageHeader } from '../components/ui/page-header.jsx';
import DoctorDashboard from '../components/dashboard/DoctorDashboard.jsx';
import OwnerDashboard from '../components/dashboard/OwnerDashboard.jsx';
import PatientDashboard from '../components/dashboard/PatientDashboard.jsx';
import { ROLES, ADMIN_TIER_ROLES } from '../constants/roles.js';

/**
 * Single authenticated landing page — role-aware. Renders inside
 * `AppShell` (see App.jsx), which now owns the header/nav chrome
 * this page used to draw itself (FET-02).
 */
export default function DashboardPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  // FET-05 — Owner/Super Admin/Director/Admin land on the Super
  // Admin dashboard, which draws its own "Welcome, {name}" heading
  // (see OwnerDashboard.jsx) rather than the generic PageHeader
  // below, so it isn't rendered twice.
  if (user?.role && ADMIN_TIER_ROLES.includes(user.role)) {
    return <OwnerDashboard user={user} />;
  }

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: t('dashboard.breadcrumb') }]}
        title={t('dashboard.welcome', { name: user?.name || '' })}
        description={
          <>
            {t('dashboard.signedInAs')} <span className="font-medium">{user?.role}</span>
          </>
        }
      />

      {user?.role === ROLES.DOCTOR ? (
        <DoctorDashboard user={user} />
      ) : user?.role === ROLES.PATIENT ? (
        <PatientDashboard user={user} />
      ) : (
        <Card className="max-w-xl">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            {t('dashboard.genericPlaceholder')}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
