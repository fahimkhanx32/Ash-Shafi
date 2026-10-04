import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollText, User, Shield, Stethoscope, Lock, FileText, Upload, Activity } from 'lucide-react';

import { PageHeader } from '../components/ui/page-header.jsx';
import { Button } from '../components/ui/button.jsx';
import { TabList } from '../components/ui/tabs.jsx';
import AuditLogSection from '../components/audit-admin/AuditLogSection.jsx';
import SensitiveRecordAccessSection from '../components/audit-admin/SensitiveRecordAccessSection.jsx';
import FileAccessSection from '../components/audit-admin/FileAccessSection.jsx';
import SecurityEventsSection from '../components/security-admin/SecurityEventsSection.jsx';

export default function AuditAdminPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('log');
  const [refreshNonce, setRefreshNonce] = useState(0);

  const tabs = [
    { value: 'log', category: '', label: t('audit.tabs.logs', 'Audit log'), icon: ScrollText },
    { value: 'user', category: 'USER_ACTION', label: t('audit.tabs.userActivity', 'User activity'), icon: User },
    { value: 'admin', category: 'ADMINISTRATIVE_ACTION', label: t('audit.tabs.adminActivity', 'Administrative activity'), icon: Shield },
    { value: 'clinical', category: 'CLINICAL_ACCESS', label: t('audit.tabs.clinicalAccess', 'Clinical record access'), icon: Stethoscope },
    { value: 'sensitive', label: t('audit.tabs.sensitiveAccess', 'Sensitive-record access'), icon: Lock },
    { value: 'file', label: t('audit.tabs.fileAccess', 'File access'), icon: FileText },
    { value: 'export', category: 'DATA_EXPORT', label: t('audit.tabs.dataExports', 'Data exports'), icon: Upload },
    { value: 'security', label: t('security.tabs.events', 'Security events'), icon: Activity },
  ];

  const activeMeta = tabs.find((tab) => tab.value === activeTab) || tabs[0];
  const sectionKey = `${activeMeta.value}-${refreshNonce}`;

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: t('nav.dashboard', 'Dashboard'), to: '/dashboard' },
          { label: t('audit.title', 'Audit Administration') },
        ]}
        title={t('audit.title', 'Audit Administration')}
        description={t('audit.subtitle', 'System-wide record of user, administrative, and record-access activity.')}
        actions={
          <Button variant="outline" size="sm" onClick={() => setRefreshNonce((n) => n + 1)}>
            {t('common.refresh', 'Refresh')}
          </Button>
        }
      />

      <TabList tabs={tabs} value={activeTab} onChange={setActiveTab} />

      {activeMeta.value === 'sensitive' ? (
        <SensitiveRecordAccessSection key={sectionKey} />
      ) : activeMeta.value === 'file' ? (
        <FileAccessSection key={sectionKey} />
      ) : activeMeta.value === 'security' ? (
        <SecurityEventsSection key={sectionKey} />
      ) : (
        <AuditLogSection
          key={sectionKey}
          category={activeMeta.category}
          emptyLabel={t('audit.emptyDesc', 'No audit records found.')}
        />
      )}
    </div>
  );
}
