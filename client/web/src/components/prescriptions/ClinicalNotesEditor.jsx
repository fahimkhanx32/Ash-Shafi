import { useTranslation } from 'react-i18next';
import { Calendar, FileText, Clock, Maximize2 } from 'lucide-react';

const FOLLOW_UP_PRESETS = [
  { label: '1 Week', days: 7 },
  { label: '2 Weeks', days: 14 },
  { label: '1 Month', days: 30 },
  { label: '3 Months', days: 90 },
  { label: '6 Months', days: 180 },
];

export default function ClinicalNotesEditor({
  form,
  onChange,
  onOpenModal,
  disabled = false,
}) {
  const { t } = useTranslation();

  const setField = (name) => (e) => {
    onChange({ [name]: e.target.value });
  };

  const setFollowUp = (patch) => {
    const current = form.nextFollowUp || {};
    onChange({
      nextFollowUp: { ...current, ...patch },
      followUpDate: patch.date !== undefined ? patch.date : form.followUpDate,
    });
  };

  const setFollowUpByDays = (days, label) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    const dateStr = d.toISOString().slice(0, 10);
    setFollowUp({ date: dateStr, quickOption: label });
  };

  const followUp = form.nextFollowUp || {};
  const currentDateVal = followUp.date ? String(followUp.date).slice(0, 10) : form.followUpDate ? String(form.followUpDate).slice(0, 10) : '';

  const renderSectionHeader = (key, label) => (
    <div className="flex items-center justify-between mb-1">
      <label className="text-xs font-bold text-foreground block">
        {label}
      </label>
      {onOpenModal && !disabled && (
        <button
          type="button"
          onClick={() => onOpenModal(key)}
          className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium transition-colors hover:underline cursor-pointer"
          title={`Open full ${label} editor`}
        >
          <Maximize2 size={11} />
          <span>Editor</span>
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* 1. Chief Complaint & Co-Morbidities */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          {renderSectionHeader('chiefComplaint', t('clinical.prescription.chiefComplaint', 'Chief Complaint'))}
          <textarea
            data-voice-field="chiefComplaint"
            rows={2}
            disabled={disabled}
            placeholder="e.g. on f/u visit, vomiting, fever (for 1 days), bilat loin pain"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs leading-relaxed focus:ring-1 focus:ring-primary"
            value={form.chiefComplaint || ''}
            onChange={setField('chiefComplaint')}
          />
        </div>

        <div>
          {renderSectionHeader('coMorbidities', t('clinical.prescription.coMorbidities', 'Co-Morbidities'))}
          <textarea
            data-voice-field="coMorbidities"
            rows={2}
            disabled={disabled}
            placeholder="e.g. DM, HTN, Hypothyroidism, CKD"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs leading-relaxed focus:ring-1 focus:ring-primary"
            value={form.coMorbidities || ''}
            onChange={setField('coMorbidities')}
          />
        </div>
      </div>

      {/* 2. Past History, Personal History, Smoking History, Menstrual History & Drug History */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <div>
          {renderSectionHeader('pastHistory', t('clinical.prescription.pastHistory', 'Past History'))}
          <textarea
            data-voice-field="pastHistory"
            rows={2}
            disabled={disabled}
            placeholder="e.g. CS - 2005, DVT"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs leading-relaxed focus:ring-1 focus:ring-primary"
            value={form.pastHistory || ''}
            onChange={setField('pastHistory')}
          />
        </div>

        <div>
          {renderSectionHeader('personalHistory', 'Personal History')}
          <textarea
            data-voice-field="personalHistory"
            rows={2}
            disabled={disabled}
            placeholder="e.g. Non-veg diet, sedentary lifestyle"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs leading-relaxed focus:ring-1 focus:ring-primary"
            value={form.personalHistory || ''}
            onChange={setField('personalHistory')}
          />
        </div>

        <div>
          {renderSectionHeader('smokingHistory', 'Smoking History')}
          <textarea
            data-voice-field="smokingHistory"
            rows={2}
            disabled={disabled}
            placeholder="e.g. Non-smoker, or 10 cigs/day"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs leading-relaxed focus:ring-1 focus:ring-primary"
            value={form.smokingHistory || ''}
            onChange={setField('smokingHistory')}
          />
        </div>

        <div>
          {renderSectionHeader('menstrualHistory', t('clinical.prescription.menstrualHistory', 'Menstrual History'))}
          <textarea
            data-voice-field="menstrualHistory"
            rows={2}
            disabled={disabled}
            placeholder="e.g. MC: 2024 Para: 2(NVD) + 1 IUD(CS)"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs leading-relaxed focus:ring-1 focus:ring-primary"
            value={form.menstrualHistory || ''}
            onChange={setField('menstrualHistory')}
          />
        </div>

        <div>
          {renderSectionHeader('drugHistory', t('clinical.prescription.drugHistory', 'Drug History'))}
          <textarea
            data-voice-field="drugHistory"
            rows={2}
            disabled={disabled}
            placeholder="e.g. Inj. Meropen 500mg, Tab. Lino 5mg"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs leading-relaxed focus:ring-1 focus:ring-primary"
            value={form.drugHistory || ''}
            onChange={setField('drugHistory')}
          />
        </div>
      </div>

      {/* 3. Pathology & Imaging and Test Advices */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          {renderSectionHeader('pathologyAndImaging', t('clinical.prescription.pathologyAndImaging', 'Pathology & Imaging'))}
          <textarea
            data-voice-field="pathologyAndImaging"
            rows={2}
            disabled={disabled}
            placeholder="e.g. S. Creatinine: 6.68 mg/dL, Hb: 12.50 gm/dL, USG: mild MR"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs leading-relaxed focus:ring-1 focus:ring-primary"
            value={form.pathologyAndImaging || ''}
            onChange={setField('pathologyAndImaging')}
          />
        </div>

        <div>
          {renderSectionHeader('testAdvices', t('clinical.prescription.testAdvices', 'Test Advices'))}
          <textarea
            data-voice-field="testAdvices"
            rows={2}
            disabled={disabled}
            placeholder="e.g. CBC, serum creatinine, serum electrolyte, BUN, TSH, USG whole abdomen with pvr রিপোর্ট নিয়ে দেখা করবেন"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs leading-relaxed focus:ring-1 focus:ring-primary"
            value={form.testAdvices || ''}
            onChange={setField('testAdvices')}
          />
        </div>
      </div>

      {/* 4. Next Follow Up */}
      <div className="rounded-xl border border-border p-3 bg-card/60 space-y-2">
        <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
          <Calendar size={14} className="text-primary" />
          <span>{t('clinical.prescription.nextFollowUp', 'Next Follow Up (পরবর্তী সাক্ষাতের সময়)')}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
          <div className="sm:col-span-4">
            <input
              type="date"
              disabled={disabled}
              className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs font-medium"
              value={currentDateVal}
              onChange={(e) => setFollowUp({ date: e.target.value })}
            />
          </div>

          <div className="sm:col-span-4">
            <input
              type="text"
              disabled={disabled}
              placeholder="Instruction (e.g. রিপোর্ট নিয়ে দেখা করবেন)"
              className="w-full h-8 px-2.5 rounded-lg border border-border bg-background text-xs"
              value={followUp.instruction || ''}
              onChange={(e) => setFollowUp({ instruction: e.target.value })}
            />
          </div>

          {/* Quick presets */}
          {!disabled && (
            <div className="sm:col-span-4 flex flex-wrap gap-1">
              {FOLLOW_UP_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  className="px-2 py-0.5 rounded text-[10px] bg-muted/60 hover:bg-primary hover:text-primary-foreground border border-border text-foreground transition-colors font-medium"
                  onClick={() => setFollowUpByDays(p.days, p.label)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
