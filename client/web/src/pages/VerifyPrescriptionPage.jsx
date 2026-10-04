import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, AlertCircle, ShieldCheck, FileText, ArrowLeft, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import * as prescriptionsService from '../services/prescriptionsService.js';
import { extractApiError } from '../services/apiClient.js';
import { Button } from '../components/ui/button.jsx';
import { Badge } from '../components/ui/badge.jsx';
import { Spinner } from '../components/ui/spinner.jsx';
import { formatDate } from '../lib/dateFormat.js';

export default function VerifyPrescriptionPage() {
  const { t } = useTranslation();
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError('');

    prescriptionsService
      .verifyPrescriptionToken(token)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        setError(extractApiError(err).message || 'Invalid or expired prescription verification token.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-card rounded-3xl border border-border shadow-2xl p-6 sm:p-8 space-y-6 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
          <ShieldCheck size={32} />
        </div>

        <div>
          <h1 className="text-xl font-bold text-foreground">Ash-Shāfī Medical Care</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Authentic Clinical Record Verification</p>
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center gap-3">
            <Spinner className="h-8 w-8 text-primary" />
            <p className="text-xs text-muted-foreground">Verifying digital certificate and signature...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-2xl bg-destructive/10 text-destructive text-xs space-y-2">
            <AlertCircle size={20} className="mx-auto" />
            <p className="font-semibold">{error}</p>
          </div>
        ) : data ? (
          <div className="space-y-4 text-left">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-300 dark:border-emerald-800 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold">
                <CheckCircle2 size={16} /> Authentic Medical Record
              </div>
              <p className="text-slate-800 dark:text-slate-200">
                This document was authored and digitally signed at Ash-Shāfī Nephrology & Medical Center.
              </p>
            </div>

            <div className="space-y-2.5 text-xs text-slate-800 dark:text-slate-200 divide-y divide-border/60">
              <div className="flex justify-between pt-1">
                <span className="font-semibold text-muted-foreground">Prescription ID:</span>
                <span className="font-mono font-bold text-primary">{data.prescriptionId}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="font-semibold text-muted-foreground">Patient:</span>
                <span className="font-semibold text-foreground">{data.patientName} ({data.patientId})</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="font-semibold text-muted-foreground">Supervising Doctor:</span>
                <span className="font-medium">{data.doctorName}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="font-semibold text-muted-foreground">Date:</span>
                <span>{formatDate(data.prescriptionDate)}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="font-semibold text-muted-foreground">Record Status:</span>
                <Badge variant={data.isFinalized ? 'success' : 'warning'}>
                  {data.status || (data.isFinalized ? 'FINALIZED' : 'DRAFT')}
                </Badge>
              </div>
            </div>
          </div>
        ) : null}

        <div className="pt-2">
          <Button asChild variant="outline" className="w-full text-xs">
            <Link to="/">
              <ArrowLeft size={14} className="mr-1" /> Return to Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
