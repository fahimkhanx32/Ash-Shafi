import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, Stethoscope } from 'lucide-react';

import * as encountersService from '../../services/encountersService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Badge } from '../ui/badge.jsx';
import { Button } from '../ui/button.jsx';
import { EmptyState, ErrorState } from '../ui/empty-state.jsx';
import { TableSkeleton } from '../ui/skeleton.jsx';
import {
  TableContainer,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../ui/table.jsx';
import { formatDate } from '../../lib/dateFormat.js';

const statusVariant = (status) => {
  if (status === 'FINALIZED') return 'success';
  if (status === 'DRAFT') return 'warning';
  if (status === 'AMENDED') return 'info';
  return 'neutral';
};

/**
 * FET-06/FET-08 — Consultations tab: real list of this patient's
 * clinical encounters (`GET /encounters/patient/:patientProfileId`,
 * `MEDICAL_RECORDS_READ`, BET-09). FET-06 only built the read-only
 * history view; FET-08 adds the "New consultation" entry point and
 * makes each row open the full consultation workspace
 * (`ConsultationPage`) for creating/editing/finalizing/amending —
 * this tab stays a thin list, the actual workflow lives there.
 */
const statusLabelKey = (status) => `clinical.encounter.status.${status}`;

export default function ConsultationsTab({ patientProfileId, canWrite = false }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [state, setState] = useState('loading'); // loading | ready | error
  const [items, setItems] = useState([]);
  const [errorMessage, setErrorMessage] = useState('');

  const load = () => {
    setState('loading');
    encountersService
      .listEncountersByPatient(patientProfileId)
      .then((data) => {
        setItems(data);
        setState('ready');
      })
      .catch((error) => {
        setErrorMessage(extractApiError(error).message);
        setState('error');
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientProfileId]);

  const newConsultationButton = canWrite ? (
    <Button
      size="sm"
      onClick={() => navigate(`/dashboard/patients/${patientProfileId}/consultations/new`)}
    >
      <Plus size={14} /> {t('clinical.consultation.newTitle')}
    </Button>
  ) : null;

  if (state === 'loading') {
    return (
      <TableContainer>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('clinical.fields.date')}</TableHead>
              <TableHead>{t('clinical.fields.provider')}</TableHead>
              <TableHead>{t('clinical.encounter.chiefComplaint')}</TableHead>
              <TableHead>{t('clinical.encounter.assessment')}</TableHead>
              <TableHead>{t('clinical.fields.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableSkeleton rows={4} columns={5} />
          </TableBody>
        </Table>
      </TableContainer>
    );
  }
  if (state === 'error') return <ErrorState description={errorMessage} onRetry={load} />;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Stethoscope}
        title={t('clinical.consultation.emptyTitle')}
        description={t('clinical.consultation.emptyDescription')}
        action={newConsultationButton}
      />
    );
  }

  return (
    <div className="space-y-3">
      {canWrite ? <div className="flex justify-end">{newConsultationButton}</div> : null}

      {/* Master prompt §12/§30/§31 — cards below `lg`, table at `lg`+. */}
      <div className="grid gap-3 lg:hidden">
        {items.map((encounter) => (
          <button
            key={encounter._id || encounter.id}
            type="button"
            onClick={() =>
              navigate(
                `/dashboard/patients/${patientProfileId}/consultations/${encounter._id || encounter.id}`,
              )
            }
            className="w-full rounded-xl border border-border bg-card p-4 text-left shadow-one-ui transition-colors active:bg-accent/30"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{formatDate(encounter.encounterDate)}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {encounter.provider?.name || '—'}
                </p>
              </div>
              <Badge variant={statusVariant(encounter.status)}>{t(statusLabelKey(encounter.status))}</Badge>
            </div>
            <div className="mt-3 space-y-1.5 text-xs">
              <div>
                <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  {t('clinical.encounter.chiefComplaint')}
                </span>
                <span className="block truncate">{encounter.chiefComplaint || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] uppercase tracking-wide text-muted-foreground/70">
                  {t('clinical.encounter.assessment')}
                </span>
                <span className="block truncate">{encounter.assessment || '—'}</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="hidden lg:block">
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('clinical.fields.date')}</TableHead>
                <TableHead>{t('clinical.fields.provider')}</TableHead>
                <TableHead>{t('clinical.encounter.chiefComplaint')}</TableHead>
                <TableHead>{t('clinical.encounter.assessment')}</TableHead>
                <TableHead>{t('clinical.fields.status')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((encounter) => (
                <TableRow
                  key={encounter._id || encounter.id}
                  className="cursor-pointer"
                  onClick={() =>
                    navigate(
                      `/dashboard/patients/${patientProfileId}/consultations/${encounter._id || encounter.id}`,
                    )
                  }
                >
                  <TableCell>{formatDate(encounter.encounterDate)}</TableCell>
                  <TableCell>{encounter.provider?.name || '—'}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{encounter.chiefComplaint || '—'}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{encounter.assessment || '—'}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(encounter.status)}>{t(statusLabelKey(encounter.status))}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </div>
    </div>
  );
}
