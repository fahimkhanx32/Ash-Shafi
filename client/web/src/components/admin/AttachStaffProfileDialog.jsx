import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogCloseButton,
} from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import * as staffService from '../../services/staffService.js';
import { extractApiError } from '../../services/apiClient.js';
import { STAFF_DESIGNATIONS, STAFF_EMPLOYMENT_TYPES, labelFor } from '../../constants/staff.js';

const inputClass =
  'w-full min-h-[44px] h-11 sm:h-10 rounded-xl border border-border bg-background px-3 text-base sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

const emptyForm = {
  designation: 'SUPPORT_STAFF',
  customDesignationLabel: '',
  department: '',
  phone: '',
  employmentType: 'FULL_TIME',
  specialization: '',
  registrationNumber: '',
  yearsOfExperience: '',
};

/**
 * FET-05 recovery UI. Companion to `AddStaffDialog`, for the exact
 * failure case its own error message references but never actually
 * had a way to complete: `POST /users` succeeded, the follow-up
 * `POST /staff` didn't, and the resulting account has no StaffProfile
 * — invisible both from the ordinary staff list (`GET /staff` only
 * reads `StaffProfile` documents) and, before this fix, unrecoverable
 * without a direct DB query.
 *
 * Deliberately does NOT re-collect name/email/username/account role —
 * that account already exists and is correct; this only fills in the
 * missing HR half via the same real `POST /staff` endpoint
 * `AddStaffDialog` already uses. `user` is the plain object returned
 * by `staffService.listOrphanedStaffUsers` (already has `.id`).
 */
export default function AttachStaffProfileDialog({ open, onOpenChange, user, onAttached }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (name) => (event) => {
    const value = event?.target ? event.target.value : event;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const reset = () => {
    setForm(emptyForm);
    setError('');
  };

  const handleClose = (nextOpen) => {
    if (!nextOpen && !saving) reset();
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!user) return;

    setSaving(true);
    setError('');

    try {
      const doctorDetails =
        form.designation === 'DOCTOR'
          ? {
              specialization: form.specialization.trim(),
              registrationNumber: form.registrationNumber.trim(),
              ...(form.yearsOfExperience
                ? { yearsOfExperience: Number(form.yearsOfExperience) }
                : {}),
            }
          : undefined;

      await staffService.createStaffProfile({
        userId: user.id,
        designation: form.designation,
        ...(form.designation === 'OTHER'
          ? { customDesignationLabel: form.customDesignationLabel.trim() }
          : {}),
        department: form.department.trim() || undefined,
        phone: form.phone.trim() || undefined,
        employmentType: form.employmentType || undefined,
        ...(doctorDetails ? { doctorDetails } : {}),
      });

      reset();
      onOpenChange(false);
      onAttached?.();
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {open && user ? (
        <form onSubmit={handleSubmit} className="relative">
          <DialogCloseButton onClose={() => handleClose(false)} />
          <DialogHeader>
            <DialogTitle>{t('staff.attachProfile', 'Finish staff setup')}</DialogTitle>
            <DialogDescription>
              {t(
                'staff.attachProfileDescription',
                'This account exists and can already log in, but is missing its HR/staff profile.',
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1 space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="rounded-xl border border-border bg-muted/30 px-3 py-2">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">
                {user.email} · {labelFor(user.role) === user.role ? user.role : labelFor(user.role)}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t('staff.colDesignation', 'Designation')}</label>
                <select className={inputClass} value={form.designation} onChange={set('designation')}>
                  {STAFF_DESIGNATIONS.map((designation) => (
                    <option key={designation} value={designation}>
                      {labelFor(designation)}
                    </option>
                  ))}
                </select>
              </div>

              {form.designation === 'OTHER' ? (
                <div className="sm:col-span-2">
                  <label className={labelClass}>{t('staff.customDesignationLabel', 'Custom designation label')}</label>
                  <input
                    required
                    className={inputClass}
                    value={form.customDesignationLabel}
                    onChange={set('customDesignationLabel')}
                  />
                </div>
              ) : null}

              <div>
                <label className={labelClass}>{t('staff.colDepartment', 'Department')}</label>
                <input className={inputClass} value={form.department} onChange={set('department')} />
              </div>
              <div>
                <label className={labelClass}>{t('staff.phone', 'Phone')}</label>
                <input className={inputClass} value={form.phone} onChange={set('phone')} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('staff.employmentType', 'Employment type')}</label>
                <select
                  className={inputClass}
                  value={form.employmentType}
                  onChange={set('employmentType')}
                >
                  {STAFF_EMPLOYMENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {labelFor(type)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {form.designation === 'DOCTOR' ? (
              <div className="rounded-xl border border-border p-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">{t('staff.doctorDetails', 'Doctor details')}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>{t('staff.specialization', 'Specialization')}</label>
                    <input
                      required
                      className={inputClass}
                      value={form.specialization}
                      onChange={set('specialization')}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t('staff.registrationNumber', 'Registration number')}</label>
                    <input
                      required
                      className={inputClass}
                      value={form.registrationNumber}
                      onChange={set('registrationNumber')}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>{t('staff.yearsOfExperience', 'Years of experience')}</label>
                    <input
                      type="number"
                      min="0"
                      className={inputClass}
                      value={form.yearsOfExperience}
                      onChange={set('yearsOfExperience')}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={() => handleClose(false)} disabled={saving}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? t('common.saving', 'Saving…') : t('staff.attachProfileSubmit', 'Complete setup')}
            </Button>
          </DialogFooter>
        </form>
      ) : null}
    </Dialog>
  );
}
