import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useAuth } from '../providers/AuthProvider.jsx';
import { useExportHistory } from '../hooks/useExportHistory.js';
import { DATA_EXPORT_ROLES, DATA_IMPORT_ROLES } from '../constants/roles.js';
import { PageHeader } from '../components/ui/page-header.jsx';
import { TabList } from '../components/ui/tabs.jsx';
import { ExportTab } from '../components/dataTools/ExportTab.jsx';
import { ImportTab } from '../components/dataTools/ImportTab.jsx';
import { ExportHistoryPanel } from '../components/dataTools/ExportHistoryPanel.jsx';

/**
 * FET-21 — "Import/Export" (master prompt's Phase 8 checklist).
 * Each tab is independently gated: a role holding only `DATA_IMPORT`
 * (RECEPTIONIST) sees just Import + History; a role holding only
 * `DATA_EXPORT` (DOCTOR) sees just Export + History. This mirrors
 * the backend exactly — see `constants/roles.js`'s `DATA_EXPORT_ROLES`/
 * `DATA_IMPORT_ROLES` doc comments for how those were verified
 * against `security/permissions.js` role-by-role.
 *
 * "History" is now backed by the real `GET /audit-logs/me` endpoint
 * (`useExportHistory.js`) rather than a client-local log — `refresh`
 * is called after every successful export/import instead of the
 * earlier `recordEntry(entry)` call, since the backend is now the
 * sole source of truth.
 */
export default function DataToolsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const history = useExportHistory();

  const canExport = DATA_EXPORT_ROLES.includes(user?.role);
  const canImport = DATA_IMPORT_ROLES.includes(user?.role);

  const tabs = useMemo(() => {
    const list = [];
    if (canExport) list.push({ value: 'export', label: t('dataTools.tabs.export') });
    if (canImport) list.push({ value: 'import', label: t('dataTools.tabs.import') });
    list.push({ value: 'history', label: t('dataTools.tabs.history') });
    return list;
  }, [canExport, canImport, t]);

  const [activeTab, setActiveTab] = useState(tabs[0]?.value);

  return (
    <div>
      <PageHeader
        breadcrumbs={[{ label: t('dashboard.breadcrumb'), to: '/dashboard' }, { label: t('dataTools.title') }]}
        title={t('dataTools.title')}
        description={t('dataTools.description')}
      />

      <TabList tabs={tabs} value={activeTab} onChange={setActiveTab} />

      <div className="mt-4">
        {activeTab === 'export' && canExport ? <ExportTab onExported={history.refresh} /> : null}
        {activeTab === 'import' && canImport ? <ImportTab onImported={history.refresh} /> : null}
        {activeTab === 'history' ? <ExportHistoryPanel history={history} /> : null}
      </div>
    </div>
  );
}

