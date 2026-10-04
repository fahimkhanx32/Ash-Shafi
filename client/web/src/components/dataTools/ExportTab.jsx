import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, FileText, Search } from 'lucide-react';

import * as exportsService from '../../services/exportsService.js';
import * as patientsService from '../../services/patientsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Button } from '../ui/button.jsx';
import { Card, CardContent } from '../ui/card.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import { formatTime } from '../../lib/dateFormat.js';
import {
  EXPORT_ENTITY_TYPES,
  EXPORT_ENTITY_FILTER_FIELDS,
  TABULAR_EXPORT_FORMATS,
  MEDICAL_RECORD_EXPORT_FORMATS,
} from '../../constants/dataTools.js';

const inputClass = 'w-full h-9 rounded-lg border border-border bg-background px-2.5 text-sm';
const labelClass = 'text-xs font-medium text-muted-foreground mb-1 block';

const FILTER_FIELD_META_KEYS = {
  search: { label: 'dataTools.export.fields.search', placeholder: 'dataTools.export.fields.searchPlaceholder' },
  patientStatus: {
    label: 'dataTools.export.fields.patientStatus',
    placeholder: 'dataTools.export.fields.patientStatusPlaceholder',
  },
  gender: { label: 'dataTools.export.fields.gender', placeholder: 'dataTools.export.fields.genderPlaceholder' },
  patientProfileId: {
    label: 'dataTools.export.fields.patientProfileId',
    placeholder: 'dataTools.export.fields.patientProfileIdPlaceholder',
  },
  status: { label: 'dataTools.export.fields.status', placeholder: 'dataTools.export.fields.statusPlaceholder' },
  category: { label: 'dataTools.export.fields.category', placeholder: 'dataTools.export.fields.categoryPlaceholder' },
};

/**
 * FET-21 checkpoint 1 — bulk tabular export
 * (`GET /exports/:entityType?format=...`). Filter inputs are driven
 * by `EXPORT_ENTITY_FILTER_FIELDS` so switching entity type never
 * shows a field the backend would silently ignore for that entity.
 * All filter values are sent as plain strings — `tabularExportQuerySchema`
 * (`export.validation.js`) is the sole validator; this form does not
 * duplicate that logic client-side, it just surfaces whatever error
 * message comes back.
 */
export function ExportTab({ onExported }) {
  const { t } = useTranslation();
  const [entityType, setEntityType] = useState(EXPORT_ENTITY_TYPES.PATIENTS);
  const [format, setFormat] = useState('CSV');
  const [filters, setFilters] = useState({});
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [lastResult, setLastResult] = useState(null);

  const fields = EXPORT_ENTITY_FILTER_FIELDS[entityType] || [];

  const setFilter = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  const handleEntityChange = (value) => {
    setEntityType(value);
    setFilters({});
    setLastResult(null);
    setError('');
  };

  const handleExport = async () => {
    setExporting(true);
    setError('');
    try {
      const cleanFilters = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''),
      );
      const { blob, filename, recordCount } = await exportsService.exportEntityTabular(
        entityType,
        format,
        cleanFilters,
      );
      exportsService.saveBlob(blob, filename);
      setLastResult({ filename, recordCount });
      onExported?.({
        kind: 'tabular',
        entityType,
        format,
        filename,
        recordCount,
      });
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold mb-1">{t('dataTools.export.bulkTitle')}</h3>
          <p className="text-sm text-muted-foreground mb-4">{t('dataTools.export.bulkDescription')}</p>

          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <span className={labelClass}>{t('dataTools.export.entityType')}</span>
              <select
                className={inputClass}
                value={entityType}
                onChange={(e) => handleEntityChange(e.target.value)}
              >
                {Object.values(EXPORT_ENTITY_TYPES).map((type) => (
                  <option key={type} value={type}>
                    {t(`dataTools.export.entities.${type}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className={labelClass}>{t('dataTools.export.format')}</span>
              <select className={inputClass} value={format} onChange={(e) => setFormat(e.target.value)}>
                {TABULAR_EXPORT_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {fields.length > 0 ? (
            <div className="grid sm:grid-cols-3 gap-4 mb-4">
              {fields.map((field) => {
                const meta = FILTER_FIELD_META_KEYS[field];
                return (
                  <div key={field}>
                    <span className={labelClass}>{meta ? t(meta.label) : field}</span>
                    <input
                      className={inputClass}
                      placeholder={meta ? t(meta.placeholder) : undefined}
                      value={filters[field] || ''}
                      onChange={(e) => setFilter(field, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}

          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {lastResult ? (
            <Alert variant="success" className="mb-4">
              <AlertDescription>
                {t('dataTools.export.downloaded', {
                  count: lastResult.recordCount,
                  filename: lastResult.filename,
                })}
              </AlertDescription>
            </Alert>
          ) : null}

          <Button onClick={handleExport} disabled={exporting}>
            <Download size={16} />
            {exporting ? t('dataTools.export.exporting') : t('dataTools.export.button')}
          </Button>
        </CardContent>
      </Card>

      <MedicalRecordExportCard onExported={onExported} />
    </div>
  );
}

/**
 * FET-21 checkpoint 2 — single-patient medical-record export
 * (`POST /exports/patients/:id/medical-record`). Deliberately a
 * two-step flow matching the backend's own design: requesting the
 * export returns only a single-use, time-limited download token —
 * the actual file bytes are fetched separately via
 * `downloadControlledExport`, never held client-side in between.
 */
function MedicalRecordExportCard({ onExported }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [format, setFormat] = useState('PDF');
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState('');
  const [tokenInfo, setTokenInfo] = useState(null);

  const search = async (value) => {
    setQuery(value);
    setSelected(null);
    setTokenInfo(null);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const { items } = await patientsService.listPatients({ search: value.trim(), limit: 8 });
      setResults(items);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const requestExport = async () => {
    if (!selected) return;
    setRequesting(true);
    setError('');
    try {
      const result = await exportsService.requestMedicalRecordExport(selected.id || selected._id, format);
      setTokenInfo(result);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setRequesting(false);
    }
  };

  const downloadNow = async () => {
    if (!tokenInfo) return;
    setError('');
    try {
      const { blob, filename } = await exportsService.downloadControlledExport(
        tokenInfo.downloadToken,
        tokenInfo.filename,
      );
      exportsService.saveBlob(blob, filename);
      onExported?.({
        kind: 'medical-record',
        patientLabel: `${selected.firstName} ${selected.lastName} (${selected.patientId})`,
        format,
        filename,
      });
      setTokenInfo(null);
      setSelected(null);
      setQuery('');
      setResults([]);
    } catch (err) {
      setError(extractApiError(err).message);
    }
  };

  return (
    <Card>
      <CardContent>
        <h3 className="text-sm font-semibold mb-1">{t('dataTools.export.medicalRecord.title')}</h3>
        <p className="text-sm text-muted-foreground mb-4">{t('dataTools.export.medicalRecord.description')}</p>

        {!selected ? (
          <div className="relative mb-4">
            <span className={labelClass}>{t('dataTools.export.medicalRecord.findPatient')}</span>
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className={`${inputClass} pl-8`}
                placeholder={t('dataTools.export.medicalRecord.searchPlaceholder')}
                value={query}
                onChange={(e) => search(e.target.value)}
              />
            </div>
            {searching ? (
              <p className="text-xs text-muted-foreground mt-1">{t('dataTools.export.medicalRecord.searching')}</p>
            ) : null}
            {results.length > 0 ? (
              <ul className="mt-2 rounded-lg border border-border divide-y divide-border max-h-48 overflow-y-auto">
                {results.map((p) => (
                  <li key={p.id || p._id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(p);
                        setResults([]);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent"
                    >
                      {p.firstName} {p.lastName} · {p.patientId}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 mb-4 text-sm">
            <span>
              {selected.firstName} {selected.lastName} · {selected.patientId}
            </span>
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSelected(null);
                setTokenInfo(null);
              }}
            >
              {t('dataTools.export.medicalRecord.change')}
            </button>
          </div>
        )}

        <div className="flex items-end gap-3 mb-4">
          <div>
            <span className={labelClass}>{t('dataTools.export.medicalRecord.format')}</span>
            <select className={inputClass} value={format} onChange={(e) => setFormat(e.target.value)}>
              {MEDICAL_RECORD_EXPORT_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={requestExport} disabled={!selected || requesting}>
            <FileText size={16} />
            {requesting ? t('dataTools.export.medicalRecord.preparing') : t('dataTools.export.medicalRecord.prepareButton')}
          </Button>
        </div>

        {error ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {tokenInfo ? (
          <Alert variant="success" className="mb-2">
            <AlertDescription>
              {t('dataTools.export.medicalRecord.ready', {
                filename: tokenInfo.filename,
                time: formatTime(tokenInfo.expiresAt),
              })}
              <Button size="sm" variant="outline" className="ml-3" onClick={downloadNow}>
                <Download size={14} />
                {t('dataTools.export.medicalRecord.downloadNow')}
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
