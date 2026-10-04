import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, CheckCircle2, XCircle } from 'lucide-react';

import * as importsService from '../../services/importsService.js';
import { extractApiError } from '../../services/apiClient.js';
import { Button } from '../ui/button.jsx';
import { Card, CardContent } from '../ui/card.jsx';
import { Alert, AlertDescription } from '../ui/alert.jsx';
import { Badge } from '../ui/badge.jsx';
import { IMPORT_FILE_ACCEPT, PATIENT_IMPORT_COLUMNS } from '../../constants/dataTools.js';

/**
 * FET-21 — bulk patient import (`POST /imports/patients`,
 * `patient-import.service.js`). Every row's CREATED/FAILED status
 * and error text shown here is exactly what the backend returned —
 * no client-side re-validation, no "looks fine" optimism about rows
 * the server hasn't actually processed yet.
 */
export function ImportTab({ onImported }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState(null);

  const reset = () => {
    setFile(null);
    setSummary(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setError('');
    try {
      const result = await importsService.importPatients(file);
      setSummary(result);
      onImported?.({
        kind: 'import',
        filename: file.name,
        totalRows: result.totalRows,
        createdCount: result.createdCount,
        failedCount: result.failedCount,
      });
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent>
          <h3 className="text-sm font-semibold mb-1">{t('dataTools.import.title')}</h3>
          <p className="text-sm text-muted-foreground mb-4">{t('dataTools.import.description')}</p>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {PATIENT_IMPORT_COLUMNS.map((col) => (
              <code key={col} className="text-xs bg-accent rounded px-1.5 py-0.5">
                {col}
              </code>
            ))}
          </div>

          <div className="flex items-center gap-3 mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept={IMPORT_FILE_ACCEPT}
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setSummary(null);
                setError('');
              }}
              className="text-sm"
            />
          </div>

          {error ? (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="flex gap-2">
            <Button onClick={handleImport} disabled={!file || importing}>
              <Upload size={16} />
              {importing ? t('dataTools.import.importing') : t('dataTools.import.button')}
            </Button>
            {summary ? (
              <Button variant="outline" onClick={reset}>
                {t('dataTools.import.another')}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {summary ? <ImportResultsCard summary={summary} /> : null}
    </div>
  );
}

function ImportResultsCard({ summary }) {
  const { t } = useTranslation();
  const failedRows = summary.results.filter((r) => r.status === 'FAILED');
  const createdRows = summary.results.filter((r) => r.status === 'CREATED');

  return (
    <Card>
      <CardContent>
        <h3 className="text-sm font-semibold mb-3">{t('dataTools.import.results.title')}</h3>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs text-muted-foreground">{t('dataTools.import.results.totalRows')}</p>
            <p className="text-xl font-bold">{summary.totalRows}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/30 p-3">
            <p className="text-xs text-emerald-700 dark:text-emerald-300">{t('dataTools.import.results.created')}</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
              {summary.createdCount}
            </p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 p-3">
            <p className="text-xs text-red-700 dark:text-red-300">{t('dataTools.import.results.failed')}</p>
            <p className="text-xl font-bold text-red-700 dark:text-red-300">{summary.failedCount}</p>
          </div>
        </div>

        {failedRows.length > 0 ? (
          <div className="mb-4">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">
              {t('dataTools.import.results.failedRowsTitle')}
            </h4>
            <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden max-h-64 overflow-y-auto">
              {failedRows.map((row) => (
                <li key={row.rowNumber} className="flex items-start gap-2 px-3 py-2 text-sm">
                  <XCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
                  <span>{t('dataTools.import.results.rowError', { number: row.rowNumber, error: row.error })}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {createdRows.length > 0 ? (
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">
              {t('dataTools.import.results.createdRowsTitle')}
            </h4>
            <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden max-h-64 overflow-y-auto">
              {createdRows.map((row) => (
                <li key={row.rowNumber} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                  <span>{t('dataTools.import.results.row', { number: row.rowNumber })}</span>
                  <Badge variant="neutral">{row.patientId}</Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
