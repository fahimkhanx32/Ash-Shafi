import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DatabaseBackup,
  ShieldCheck,
  ShieldAlert,
  CloudUpload,
  Trash2,
  Play,
  History,
} from 'lucide-react';

import { PageHeader } from '../components/ui/page-header.jsx';
import { Button } from '../components/ui/button.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { FilterBar } from '../components/ui/filter-bar.jsx';
import { Card, CardContent } from '../components/ui/card.jsx';
import { EmptyState, ErrorState } from '../components/ui/empty-state.jsx';
import { Skeleton, TableSkeleton } from '../components/ui/skeleton.jsx';
import { Pagination } from '../components/ui/pagination.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table.jsx';
import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogCloseButton } from '../components/ui/dialog.jsx';
import { useToast } from '../providers/ToastProvider.jsx';
import { useConfirm } from '../providers/ConfirmProvider.jsx';
import { usePermissions } from '../hooks/usePermissions.js';
import * as backupsService from '../services/backupsService.js';
import { extractApiError } from '../services/apiClient.js';
import { formatDateTime, formatRelativeTime } from '../lib/dateFormat.js';
import RestoreBackupDialog from '../components/admin/RestoreBackupDialog.jsx';

const PAGE_SIZE = 20;
const selectClass = 'h-10 rounded-lg border border-border bg-background px-3 text-sm';

const STATUS_OPTIONS = ['', 'RUNNING', 'COMPLETED', 'FAILED', 'PURGED'];

const statusVariant = (status) => {
  if (status === 'COMPLETED') return 'success';
  if (status === 'FAILED') return 'destructive';
  if (status === 'RUNNING') return 'info';
  return 'neutral';
};

const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
};

export default function BackupsPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const confirm = useConfirm();
  const { has } = usePermissions();
  const canManage = has('system:admin');

  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [state, setState] = useState('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const [triggering, setTriggering] = useState(false);
  const [purging, setPurging] = useState(false);
  const [testingId, setTestingId] = useState(null);
  const [detailBackup, setDetailBackup] = useState(null);
  const [restoreTarget, setRestoreTarget] = useState(null);

  const load = useCallback(async () => {
    setState('loading');
    setErrorMessage('');
    try {
      const result = await backupsService.listBackups({
        status: status || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setItems(result.items);
      setPagination(result.pagination);
      setState('ready');
    } catch (error) {
      setErrorMessage(extractApiError(error).message);
      setState('error');
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [status]);

  const latest = items.length > 0 && page === 1 && !status ? items[0] : null;

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      const backup = await backupsService.triggerBackup();
      toast({
        title: backup.status === 'COMPLETED' ? t('backups.backupCreated', 'Backup snapshot created successfully.') : t('common.error', 'Backup run failed.'),
        description: backup.status === 'COMPLETED' ? undefined : backup.errorMessage,
        variant: backup.status === 'COMPLETED' ? 'success' : 'destructive',
      });
      await load();
    } catch (error) {
      toast({ title: t('common.error', 'Could not start backup'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setTriggering(false);
    }
  };

  const handleRestoreTest = async (backup) => {
    setTestingId(backup.id);
    try {
      const result = await backupsService.runRestoreTest(backup.id);
      toast({
        title: result.passed ? t('backups.testPassed', 'Restore test passed.') : t('backups.testFailed', 'Restore test failed.'),
        description: result.passed ? t('backups.testPassedDesc', 'This backup archive restores cleanly.') : result.error,
        variant: result.passed ? 'success' : 'destructive',
      });
      await load();
    } catch (error) {
      toast({ title: t('common.error', 'Restore test failed to run'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setTestingId(null);
    }
  };

  const handleRestore = async ({ password, reason }) => {
    const result = await backupsService.restoreToProduction(restoreTarget.id, { password, reason });
    toast({ title: t('backups.restoreSuccess', 'Database backup restored successfully.'), variant: 'success' });
    await load();
    return result;
  };

  const handlePurge = async () => {
    const confirmed = await confirm({
      title: t('backups.purgeTitle', 'Purge expired backups?'),
      description: t('backups.purgeDesc', 'Deletes every COMPLETED backup past its retention window, except the single most recent one. This cannot be undone.'),
      confirmLabel: t('backups.purgeConfirm', 'Purge expired backups'),
      variant: 'destructive',
    });
    if (!confirmed) return;

    setPurging(true);
    try {
      const result = await backupsService.purgeExpiredBackups();
      toast({
        title: `Purged ${result.purged}, kept ${result.kept}.`,
        variant: result.errors?.length ? 'destructive' : 'success',
        description: result.errors?.length ? `${result.errors.length} error(s) — see backup history.` : undefined,
      });
      await load();
    } catch (error) {
      toast({ title: t('common.error', 'Purge failed'), description: extractApiError(error).message, variant: 'destructive' });
    } finally {
      setPurging(false);
    }
  };

  return (
    <div>
      <PageHeader
        breadcrumbs={[
          { label: t('nav.dashboard', 'Dashboard'), to: '/dashboard' },
          { label: t('backups.title', 'Backup Administration') },
        ]}
        title={t('backups.title', 'Backup & Disaster Recovery Administration')}
        description={t('backups.subtitle', 'Manage automated system database backups, manual snapshots, and restoration points.')}
        actions={
          canManage ? (
            <Button size="sm" onClick={handleTrigger} disabled={triggering}>
              <DatabaseBackup size={15} /> {triggering ? t('backups.creatingBackup', 'Creating backup…') : t('backups.triggerBackup', 'Create Backup Snapshot')}
            </Button>
          ) : null
        }
      />

      {/* Backup status — most recent run at a glance */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Backup status</h2>
        {state === 'loading' ? (
          <Skeleton className="h-24 w-full" />
        ) : latest ? (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/60">
                  <DatabaseBackup size={18} aria-hidden="true" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant(latest.status)}>{latest.status}</Badge>
                    <span className="text-xs text-muted-foreground">{latest.trigger}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Started {formatRelativeTime(latest.startedAt)}
                    {latest.completedAt ? ` · completed ${formatRelativeTime(latest.completedAt)}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant={latest.verified ? 'success' : 'neutral'}>
                  <ShieldCheck size={11} className="mr-1" /> {latest.verified ? 'Verified' : 'Not verified'}
                </Badge>
                <Badge variant={latest.googleDrive?.uploaded ? 'success' : 'neutral'}>
                  <CloudUpload size={11} className="mr-1" /> {latest.googleDrive?.uploaded ? 'Uploaded to Drive' : 'Local only'}
                </Badge>
                <span className="text-muted-foreground">{formatBytes(latest.fileSizeBytes)}</span>
                <span className="text-muted-foreground">{latest.totalDocumentCount} documents</span>
              </div>
            </CardContent>
          </Card>
        ) : state !== 'error' ? (
          <EmptyState icon={DatabaseBackup} title="No backups yet" description="Run a backup to see its status here." />
        ) : null}
      </section>

      {/* Backup configuration where authorized */}
      <section className="mb-8">
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Backup configuration</h2>
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div>
              <p className="text-sm font-medium">Retention policy</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Purges every completed backup past its retention window — the single most recent completed backup is
                always kept, regardless of age. No schedule editor exists yet; backups are run manually or
                administratively, same as this action.
              </p>
            </div>
            {canManage ? (
              <Button variant="outline" size="sm" onClick={handlePurge} disabled={purging}>
                <Trash2 size={14} /> {purging ? 'Purging…' : 'Purge expired backups'}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </section>

      {/* Backup history + verification + restore */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">Backup history</h2>
        <FilterBar>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
            {STATUS_OPTIONS.map((value) => (
              <option key={value || 'ALL'} value={value}>
                {value || 'All statuses'}
              </option>
            ))}
          </select>
        </FilterBar>

        {state === 'loading' ? (
          <TableContainer>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead hideBelow="sm">Started</TableHead>
                  <TableHead hideBelow="md">Size</TableHead>
                  <TableHead hideBelow="lg">Verified</TableHead>
                  <TableHead hideBelow="lg">Restore tested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableSkeleton rows={6} columns={6} />
              </TableBody>
            </Table>
          </TableContainer>
        ) : state === 'error' ? (
          <ErrorState description={errorMessage} onRetry={load} />
        ) : items.length === 0 ? (
          <EmptyState icon={History} title="No backups found" description="No backups match this filter yet." />
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead hideBelow="sm">Started</TableHead>
                    <TableHead hideBelow="md">Size</TableHead>
                    <TableHead hideBelow="lg">Verified</TableHead>
                    <TableHead hideBelow="lg">Restore tested</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((backup) => (
                    <TableRow key={backup.id} className="cursor-pointer" onClick={() => setDetailBackup(backup)}>
                      <TableCell>
                        <Badge variant={statusVariant(backup.status)}>{backup.status}</Badge>
                      </TableCell>
                      <TableCell hideBelow="sm" className="text-muted-foreground whitespace-nowrap">
                        {formatDateTime(backup.startedAt)}
                      </TableCell>
                      <TableCell hideBelow="md" className="text-muted-foreground">{formatBytes(backup.fileSizeBytes)}</TableCell>
                      <TableCell hideBelow="lg">
                        <Badge variant={backup.verified ? 'success' : 'neutral'}>
                          {backup.verified ? 'Verified' : 'Not verified'}
                        </Badge>
                      </TableCell>
                      <TableCell hideBelow="lg">
                        {backup.restoreTestedAt ? (
                          <Badge variant={backup.restoreTestPassed ? 'success' : 'destructive'}>
                            {backup.restoreTestPassed ? 'Passed' : 'Failed'}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not tested</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                        {canManage && backup.status === 'COMPLETED' ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestoreTest(backup)}
                              disabled={testingId === backup.id}
                            >
                              <Play size={13} /> {testingId === backup.id ? 'Testing…' : 'Test restore'}
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              onClick={() => setRestoreTarget(backup)}
                            >
                              <ShieldAlert size={13} /> Restore
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {pagination?.totalPages > 1 ? (
              <Pagination
                className="mt-4"
                page={pagination.page || page}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </section>

      {/* Backup detail dialog — full verification / restore-test detail */}
      <Dialog open={Boolean(detailBackup)} onOpenChange={(open) => !open && setDetailBackup(null)}>
        <DialogCloseButton onClose={() => setDetailBackup(null)} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DatabaseBackup size={16} aria-hidden="true" /> Backup detail
          </DialogTitle>
          {detailBackup ? (
            <DialogDescription>Started {formatDateTime(detailBackup.startedAt)}</DialogDescription>
          ) : null}
        </DialogHeader>
        {detailBackup ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(detailBackup.status)}>{detailBackup.status}</Badge>
              <Badge variant="neutral">{detailBackup.trigger}</Badge>
              <Badge variant={detailBackup.encrypted ? 'success' : 'neutral'}>
                {detailBackup.encrypted ? 'Encrypted' : 'Not encrypted'}
              </Badge>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Total documents</dt>
              <dd className="text-right font-medium">{detailBackup.totalDocumentCount}</dd>
              <dt className="text-muted-foreground">File size</dt>
              <dd className="text-right font-medium">{formatBytes(detailBackup.fileSizeBytes)}</dd>
              <dt className="text-muted-foreground">Checksum (SHA-256)</dt>
              <dd className="text-right font-mono text-xs truncate">{detailBackup.checksumSha256 || '—'}</dd>
              <dt className="text-muted-foreground">Verified</dt>
              <dd className="text-right font-medium">
                {detailBackup.verified ? formatDateTime(detailBackup.verifiedAt) : detailBackup.verificationError || 'Not verified'}
              </dd>
              <dt className="text-muted-foreground">Restore test</dt>
              <dd className="text-right font-medium">
                {detailBackup.restoreTestedAt
                  ? `${detailBackup.restoreTestPassed ? 'Passed' : 'Failed'} · ${formatDateTime(detailBackup.restoreTestedAt)}`
                  : 'Not tested'}
              </dd>
              <dt className="text-muted-foreground">Google Drive</dt>
              <dd className="text-right font-medium">
                {detailBackup.googleDrive?.uploaded
                  ? `Uploaded ${formatDateTime(detailBackup.googleDrive.uploadedAt)}`
                  : detailBackup.googleDrive?.error || 'Not uploaded'}
              </dd>
              <dt className="text-muted-foreground">Retention expires</dt>
              <dd className="text-right font-medium">
                {detailBackup.retentionExpiresAt ? formatDateTime(detailBackup.retentionExpiresAt) : '—'}
              </dd>
            </dl>
            {detailBackup.collections?.length ? (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Collections</p>
                <ul className="max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border text-xs">
                  {detailBackup.collections.map((c) => (
                    <li key={c.name} className="flex justify-between px-3 py-1.5">
                      <span>{c.name}</span>
                      <span className="text-muted-foreground">{c.documentCount}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {detailBackup.errorMessage ? (
              <p className="text-xs text-destructive">{detailBackup.errorMessage}</p>
            ) : null}
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setDetailBackup(null)}>
            Close
          </Button>
        </DialogFooter>
      </Dialog>

      <RestoreBackupDialog
        open={Boolean(restoreTarget)}
        onOpenChange={(open) => !open && setRestoreTarget(null)}
        backup={restoreTarget}
        onConfirm={handleRestore}
      />
    </div>
  );
}
