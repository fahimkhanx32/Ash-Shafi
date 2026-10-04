import { useRef, useState } from 'react';
import { FolderOpen, FileText, Lock, UploadCloud } from 'lucide-react';

const ACCEPT = '.jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf';

/**
 * "Drop your medical report here" area for the patient Reports tab.
 * It only hands the chosen file to the parent; the upload dialog then
 * collects the doctor, title and notes and does the actual submit + OCR.
 */
export default function ReportDropzone({
  onFile,
  maxMb = 25,
  accept = ACCEPT,
  formatsLabel = 'PDF, JPG, PNG, WEBP',
  title = 'medical report',
  privacyNote = 'Secure & private · Only authorized doctors can access your records',
}) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const pick = (file) => {
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        pick(e.dataTransfer.files?.[0]);
      }}
      className={`rounded-3xl border p-3 transition-colors ${
        dragging ? 'border-primary bg-primary/10' : 'border-primary/40 bg-primary/5'
      }`}
    >
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-primary/40 px-4 py-10 text-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <UploadCloud size={40} aria-hidden="true" />
        </div>
        <h3 className="text-2xl font-bold sm:text-3xl">
          Drop your <span className="text-primary">{title}</span> here
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Drag &amp; drop your file here, or{' '}
          <button type="button" className="text-primary underline-offset-2 hover:underline" onClick={() => inputRef.current?.click()}>
            browse
          </button>{' '}
          from your device
        </p>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-md transition hover:opacity-90"
        >
          <FolderOpen size={16} aria-hidden="true" /> Browse Files
        </button>

        <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
          <FileText size={14} aria-hidden="true" /> {formatsLabel} · Max {maxMb} MB
        </p>

        <p className="mt-5 flex items-center gap-2 border-t border-border/60 pt-4 text-xs text-muted-foreground">
          <Lock size={13} aria-hidden="true" /> {privacyNote}
        </p>
      </div>
    </div>
  );
}
