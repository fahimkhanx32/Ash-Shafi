import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { HeartPulse, Baby } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../../providers/AuthProvider.jsx';
import { SENSITIVE_RECORDS_ROLES } from '../../constants/roles.js';
import { PageHeader } from '../../components/ui/page-header.jsx';
import GynecologyPanel from '../../components/clinical/GynecologyPanel.jsx';
import PregnancyPanel from '../../components/clinical/PregnancyPanel.jsx';

/**
 * FET-07 — Gynecology, Sensitive Records & Pregnancy (clinician view).
 *
 * Reached via `/dashboard/clinical/:patientProfileId`, inside the
 * shared FET-02 `AppShell`. The full patient workspace described in
 * the FET-06 roadmap item (patient list → unified patient view with
 * tabs for every clinical module) doesn't exist yet, so for now a
 * doctor/admin reaches this screen by pasting in a patient's profile
 * id (see the "Open clinical record" card on the dashboard). This
 * page itself is the real, fully backend-connected FET-07
 * deliverable — once FET-06 ships the patient list/workspace shell,
 * it becomes one tab inside it rather than a standalone route; no
 * rework of the components here is expected, only where they mount.
 *
 * FET-17 — fully localized.
 */
export default function PatientClinicalPage() {
  const { t } = useTranslation();
  const { patientProfileId } = useParams();
  const { user } = useAuth();
  const [tab, setTab] = useState('gynecology');

  const canWrite = SENSITIVE_RECORDS_ROLES.includes(user?.role);

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: t('dashboard.breadcrumb'), to: '/dashboard' }, { label: t('clinical.record.breadcrumb') }]}
        title={t('clinical.record.sensitiveTitle')}
        description={
          <>
            {t('clinical.record.patientProfileLabel')} <span className="font-mono">{patientProfileId}</span>
            {!canWrite ? ` · ${t('clinical.record.readOnlyForRole')}` : ''}
          </>
        }
      />

      <div className="flex gap-2 border-b border-border pb-1 mb-5">
        <button
          type="button"
          onClick={() => setTab('gynecology')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg ${
            tab === 'gynecology'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <HeartPulse size={15} /> {t('clinical.record.tabGynecology')}
        </button>
        <button
          type="button"
          onClick={() => setTab('pregnancy')}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg ${
            tab === 'pregnancy'
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Baby size={15} /> {t('clinical.record.tabPregnancy')}
        </button>
      </div>

      {tab === 'gynecology' ? (
        <GynecologyPanel patientProfileId={patientProfileId} canWrite={canWrite} />
      ) : (
        <PregnancyPanel patientProfileId={patientProfileId} canWrite={canWrite} />
      )}
    </div>
  );
}
