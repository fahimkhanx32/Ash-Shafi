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
import * as usersService from '../../services/usersService.js';
import * as staffService from '../../services/staffService.js';
import { extractApiError } from '../../services/apiClient.js';
import { ADMIN_ASSIGNABLE_ROLES } from '../../constants/roles.js';
import { STAFF_DESIGNATIONS, STAFF_EMPLOYMENT_TYPES, labelFor } from '../../constants/staff.js';

const inputClass =
  'w-full min-h-[44px] h-11 sm:h-10 rounded-xl border border-border bg-background px-3 text-base sm:text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

const emptyForm = {
  name: '',
  email: '',
  username: '',
  role: 'STAFF',
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
 * FET-05 — "Add staff or doctor". Chains two real, already-working
 * endpoints in the natural admin workflow: `POST /users` provisions
 * the login account (never a client-supplied password — the backend
 * emails a password-setup link), then `POST /staff` attaches the HR
 * profile to the new user id. Neither call is faked or simulated;
 * if the second call fails after the first succeeds, the account
 * still exists and the error says so explicitly rather than silently
 * losing it.
 */
export default function AddStaffDialog({ open, onOpenChange, onCreated, onOrphanedUserCreated }) {
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
    setSaving(true);
    setError('');

    try {
      const user = await usersService.createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        username: form.username.trim(),
        role: form.role,
      });

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
      } catch (staffError) {
        onOrphanedUserCreated?.();
        throw new Error(
          `Account for ${user.name} was created, but the staff profile could not be ` +
            `saved: ${extractApiError(staffError).message} Look for them in the ` +
            '"missing staff profile" banner on this page to finish setup — nothing was lost.',
        );
      }

      reset();
      onOpenChange(false);
      onCreated?.();
    } catch (err) {
      setError(err.message || extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      {open ? (
        <form onSubmit={handleSubmit} className="relative">
          <DialogCloseButton onClose={() => handleClose(false)} />
          <DialogHeader>
            <DialogTitle>{t('staff.addStaff', 'Add staff or doctor')}</DialogTitle>
            <DialogDescription>
              {t('staff.addStaffDescription', "Creates a login account and staff profile. They'll receive an email to set their own password.")}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 max-h-[60vh] overflow-y-auto pr-1 space-y-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>{t('common.fullName', 'Full name')}</label>
                <input required className={inputClass} value={form.name} onChange={set('name')} />
              </div>
              <div>
                <label className={labelClass}>{t('common.username', 'Username')}</label>
                <input required className={inputClass} value={form.username} onChange={set('username')} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>{t('common.email', 'Email')}</label>
                <input
                  required
                  type="email"
                  className={inputClass}
                  value={form.email}
                  onChange={set('email')}
                />
              </div>
              <div>
                <label className={labelClass}>{t('staff.colAccountRole', 'Account role')}</label>
                <select className={inputClass} value={form.role} onChange={set('role')}>
                  {ADMIN_ASSIGNABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {labelFor(role) === role ? role : labelFor(role)}
                    </option>
                  ))}
                </select>
              </div>
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
              {saving ? t('common.creating', 'Creating…') : t('staff.createAccount', 'Create account')}
            </Button>
          </DialogFooter>
        </form>
      ) : null}
    </Dialog>
  );
}
