import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react';

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
import { TabList } from '../ui/tabs.jsx';
import * as scheduleService from '../../services/scheduleService.js';
import { extractApiError } from '../../services/apiClient.js';
import { useToast } from '../../providers/ToastProvider.jsx';
import { useConfirm } from '../../providers/ConfirmProvider.jsx';
import { WEEKDAY_LABELS } from '../../constants/appointments.js';
import { formatDate, toDateParam } from '../../lib/dateFormat.js';

const inputClass = 'w-full h-10 rounded-lg border border-border bg-background px-3 text-sm disabled:opacity-60';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

/**
 * FET-09 — "Doctor schedules", "Availability", "Holidays", "Blocked
 * dates".
 */
export default function DoctorScheduleDialog({ open, onOpenChange, doctorId, doctorName }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirmDialog = useConfirm();
  const [tab, setTab] = useState('weekly');

  const [schedule, setSchedule] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [blockedDates, setBlockedDates] = useState([]);
  const [blockedLoading, setBlockedLoading] = useState(false);
  const [newBlockedDate, setNewBlockedDate] = useState('');
  const [newBlockedReason, setNewBlockedReason] = useState('');

  const loadSchedule = () => {
    setLoading(true);
    setError('');
    scheduleService
      .getDoctorSchedule(doctorId)
      .then(setSchedule)
      .catch((err) => {
        // A doctor with no schedule yet is the normal first-time state, not
        // an error: start from the same defaults the server model uses, and
        // the first save (PUT) creates the schedule.
        if (extractApiError(err).code === 'SCHEDULE_NOT_FOUND') {
          setSchedule({
            weeklyAvailability: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
              dayOfWeek,
              isActive: false,
              blocks: [],
            })),
            slotDurationMinutes: 15,
            bufferMinutes: 0,
            consultationModes: ['PHYSICAL'],
            minBookingLeadMinutes: 60,
            maxBookingHorizonDays: 60,
            isActive: true,
          });
        } else {
          setError(extractApiError(err).message);
        }
      })
      .finally(() => setLoading(false));
  };

  const loadBlockedDates = () => {
    setBlockedLoading(true);
    scheduleService
      .listBlockedDates({ doctorId })
      .then(setBlockedDates)
      .catch(() => setBlockedDates([]))
      .finally(() => setBlockedLoading(false));
  };

  useEffect(() => {
    if (open && doctorId) {
      setTab('weekly');
      loadSchedule();
      loadBlockedDates();
    } else {
      setSchedule(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, doctorId]);

  const updateDay = (dayOfWeek, patch) => {
    setSchedule((prev) => ({
      ...prev,
      weeklyAvailability: prev.weeklyAvailability.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, ...patch } : d)),
    }));
  };

  const addBlock = (dayOfWeek) => {
    updateDay(dayOfWeek, {
      blocks: [
        ...(schedule.weeklyAvailability.find((d) => d.dayOfWeek === dayOfWeek)?.blocks || []),
        { startTime: '09:00', endTime: '17:00' },
      ],
    });
  };

  const updateBlock = (dayOfWeek, index, field, value) => {
    const day = schedule.weeklyAvailability.find((d) => d.dayOfWeek === dayOfWeek);
    const blocks = day.blocks.map((b, i) => (i === index ? { ...b, [field]: value } : b));
    updateDay(dayOfWeek, { blocks });
  };

  const removeBlock = (dayOfWeek, index) => {
    const day = schedule.weeklyAvailability.find((d) => d.dayOfWeek === dayOfWeek);
    updateDay(dayOfWeek, { blocks: day.blocks.filter((_, i) => i !== index) });
  };

  const handleSaveSchedule = async () => {
    setSaving(true);
    setError('');
    try {
      const updated = await scheduleService.upsertDoctorSchedule(doctorId, {
        weeklyAvailability: schedule.weeklyAvailability.map(({ dayOfWeek, isActive, blocks }) => ({
          dayOfWeek,
          isActive,
          blocks,
        })),
        slotDurationMinutes: Number(schedule.slotDurationMinutes),
        bufferMinutes: Number(schedule.bufferMinutes),
        consultationModes: schedule.consultationModes,
        minBookingLeadMinutes: Number(schedule.minBookingLeadMinutes),
        maxBookingHorizonDays: Number(schedule.maxBookingHorizonDays),
        isActive: schedule.isActive,
      });
      setSchedule(updated);
      toast({ title: t('appointments.scheduleSaved', 'Schedule saved'), variant: 'success' });
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddBlockedDate = async () => {
    if (!newBlockedDate) return;
    try {
      await scheduleService.createBlockedDate({ date: newBlockedDate, doctorId, reason: newBlockedReason });
      setNewBlockedDate('');
      setNewBlockedReason('');
      loadBlockedDates();
      toast({ title: t('appointments.dateBlocked', 'Date blocked'), variant: 'success' });
    } catch (err) {
      setError(extractApiError(err).message);
    }
  };

  const handleRemoveBlockedDate = async (id) => {
    const ok = await confirmDialog({
      title: t('appointments.removeBlockedTitle', 'Remove this blocked date?'),
      description: t('appointments.removeBlockedDesc', 'The date will become bookable again.'),
      confirmLabel: t('common.remove', 'Remove'),
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await scheduleService.removeBlockedDate(id);
      loadBlockedDates();
    } catch (err) {
      setError(extractApiError(err).message);
    }
  };

  const toggleMode = (mode) => {
    setSchedule((prev) => {
      const has = prev.consultationModes.includes(mode);
      const next = has ? prev.consultationModes.filter((m) => m !== mode) : [...prev.consultationModes, mode];
      return { ...prev, consultationModes: next.length ? next : prev.consultationModes };
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)} className="max-w-2xl">
      <DialogCloseButton onClose={() => onOpenChange(false)} />
      <DialogHeader>
        <DialogTitle>{t('appointments.manageSchedule', 'Manage schedule')}{doctorName ? ` — Dr. ${doctorName}` : ''}</DialogTitle>
        <DialogDescription>{t('appointments.scheduleDialogDescription', 'Weekly availability, slot settings, and holidays/blocked dates.')}</DialogDescription>
      </DialogHeader>

      <div className="mt-4">
        <TabList
          tabs={[
            { value: 'weekly', label: t('appointments.tabWeekly', 'Weekly availability') },
            { value: 'blocked', label: t('appointments.tabBlocked', 'Holidays & blocked dates') },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {error ? (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {tab === 'weekly' ? (
        loading || !schedule ? (
          <p className="mt-4 text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>
        ) : (
          <div className="mt-4 flex flex-col gap-4 max-h-[55vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelClass}>{t('appointments.slotLength', 'Slot length (min)')}</label>
                <input
                  type="number"
                  min={5}
                  max={240}
                  className={inputClass}
                  value={schedule.slotDurationMinutes}
                  onChange={(e) => setSchedule((p) => ({ ...p, slotDurationMinutes: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelClass}>{t('appointments.buffer', 'Buffer (min)')}</label>
                <input
                  type="number"
                  min={0}
                  max={120}
                  className={inputClass}
                  value={schedule.bufferMinutes}
                  onChange={(e) => setSchedule((p) => ({ ...p, bufferMinutes: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelClass}>{t('appointments.horizon', 'Booking horizon (days)')}</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  className={inputClass}
                  value={schedule.maxBookingHorizonDays}
                  onChange={(e) => setSchedule((p) => ({ ...p, maxBookingHorizonDays: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={schedule.consultationModes.includes('PHYSICAL')} onChange={() => toggleMode('PHYSICAL')} />
                {t('appointments.physicalVisits', 'Physical visits')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={schedule.consultationModes.includes('ONLINE')} onChange={() => toggleMode('ONLINE')} />
                {t('appointments.onlineVisits', 'Online visits')}
              </label>
              <label className="flex items-center gap-2 text-sm ml-auto">
                <input type="checkbox" checked={schedule.isActive} onChange={(e) => setSchedule((p) => ({ ...p, isActive: e.target.checked }))} />
                {t('appointments.scheduleActive', 'Schedule active')}
              </label>
            </div>

            <div className="divide-y divide-border rounded-lg border border-border">
              {schedule.weeklyAvailability.map((day) => (
                <div key={day.dayOfWeek} className="p-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={day.isActive}
                        onChange={(e) => updateDay(day.dayOfWeek, { isActive: e.target.checked })}
                      />
                      {WEEKDAY_LABELS[day.dayOfWeek]}
                    </label>
                    {day.isActive ? (
                      <button type="button" className="text-xs text-primary hover:underline flex items-center gap-1" onClick={() => addBlock(day.dayOfWeek)}>
                        <Plus size={12} /> {t('appointments.addBlock', 'Add block')}
                      </button>
                    ) : null}
                  </div>
                  {day.isActive && day.blocks.length > 0 ? (
                    <div className="mt-2 flex flex-col gap-2">
                      {day.blocks.map((block, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="time"
                            className={inputClass}
                            value={block.startTime}
                            onChange={(e) => updateBlock(day.dayOfWeek, index, 'startTime', e.target.value)}
                          />
                          <span className="text-xs text-muted-foreground">{t('common.to', 'to')}</span>
                          <input
                            type="time"
                            className={inputClass}
                            value={block.endTime}
                            onChange={(e) => updateBlock(day.dayOfWeek, index, 'endTime', e.target.value)}
                          />
                          <button type="button" onClick={() => removeBlock(day.dayOfWeek, index)} className="text-muted-foreground hover:text-destructive">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )
      ) : (
        <div className="mt-4 flex flex-col gap-4 max-h-[55vh] overflow-y-auto pr-1">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className={labelClass}>{t('appointments.date', 'Date')}</label>
              <input type="date" className={inputClass} min={toDateParam(new Date())} value={newBlockedDate} onChange={(e) => setNewBlockedDate(e.target.value)} />
            </div>
            <div className="flex-1">
              <label className={labelClass}>{t('appointments.reasonOptional', 'Reason (optional)')}</label>
              <input className={inputClass} value={newBlockedReason} onChange={(e) => setNewBlockedReason(e.target.value)} />
            </div>
            <Button type="button" size="sm" onClick={handleAddBlockedDate} disabled={!newBlockedDate}>
              {t('appointments.blockDate', 'Block date')}
            </Button>
          </div>

          {blockedLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading…')}</p>
          ) : blockedDates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('appointments.noBlockedDates', 'No blocked dates for this doctor.')}</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {blockedDates.map((bd) => (
                <li key={bd._id || bd.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>
                    {formatDate(bd.date)}
                    {bd.reason ? ` — ${bd.reason}` : ''}
                    {bd.isRecurringYearly ? ' (yearly)' : ''}
                  </span>
                  <button type="button" onClick={() => handleRemoveBlockedDate(bd._id || bd.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'weekly' ? (
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t('common.close', 'Close')}
          </Button>
          <Button type="button" onClick={handleSaveSchedule} disabled={saving || loading}>
            {saving ? t('common.saving', 'Saving…') : t('appointments.saveSchedule', 'Save schedule')}
          </Button>
        </DialogFooter>
      ) : null}
    </Dialog>
  );
}
