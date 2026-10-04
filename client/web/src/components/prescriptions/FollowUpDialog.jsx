import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Check, X, Sparkles } from 'lucide-react';
import { Dialog, DialogHeader, DialogTitle, DialogFooter, DialogCloseButton } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';

const FOLLOW_UP_PRESETS = [
  { label: '3 Days', days: 3 },
  { label: '1 Week (৭ দিন)', days: 7 },
  { label: '2 Weeks (১৪ দিন)', days: 14 },
  { label: '1 Month (১ মাস)', days: 30 },
  { label: '3 Months (৩ মাস)', days: 90 },
  { label: '6 Months (৬ মাস)', days: 180 },
];

const INSTRUCTION_PRESETS = [
  'রিপোর্ট নিয়ে দেখা করবেন',
  'ঔষধ শেষ হলে আসবেন',
  'রক্ত ও প্রস্রাবের রিপোর্টসহ আসবেন',
  'শারীরিক সমস্যা বৃদ্ধি পেলে দ্রুত আসবেন',
  '১ মাস পর বিপি মেপে জানাবেন',
];

export default function FollowUpDialog({
  open,
  onOpenChange,
  initialDate,
  initialInstruction,
  onSave,
}) {
  const [date, setDate] = useState('');
  const [instruction, setInstruction] = useState('');

  useEffect(() => {
    if (open) {
      if (initialDate) {
        try {
          const d = new Date(initialDate);
          if (!isNaN(d.getTime())) {
            setDate(d.toISOString().slice(0, 10));
          } else {
            setDate(String(initialDate).slice(0, 10));
          }
        } catch {
          setDate('');
        }
      } else {
        setDate('');
      }
      setInstruction(initialInstruction || '');
    }
  }, [open, initialDate, initialInstruction]);

  const handleSelectDays = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  };

  const handleSave = () => {
    onSave?.({
      date: date || null,
      instruction: instruction.trim(),
    });
    onOpenChange?.(false);
  };

  const handleClear = () => {
    setDate('');
    setInstruction('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-md">
      <DialogCloseButton onClose={() => onOpenChange(false)} />
      <DialogHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Calendar size={18} />
          </div>
          <div>
            <DialogTitle>Next Visit (পরবর্তী সাক্ষাতের সময়)</DialogTitle>
          </div>
        </div>
      </DialogHeader>

      <div className="space-y-4 py-3">
        {/* Date Selection */}
        <div>
          <label className="text-xs font-bold text-foreground mb-1 block">
            Follow-Up Date:
          </label>
          <input
            type="date"
            className="w-full h-9 px-3 rounded-lg border border-border bg-background text-sm font-medium focus:ring-1 focus:ring-primary"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {/* Quick Presets */}
        <div>
          <span className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
            Quick Days Presets:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {FOLLOW_UP_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                className="px-2.5 py-1 rounded-md text-xs font-medium border border-border bg-card hover:bg-primary/10 hover:border-primary/40 hover:text-primary transition-colors"
                onClick={() => handleSelectDays(p.days)}
              >
                + {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div>
          <label className="text-xs font-bold text-foreground mb-1 block">
            Special Instructions / Notes:
          </label>
          <input
            type="text"
            placeholder="e.g. রিপোর্ট নিয়ে দেখা করবেন"
            className="w-full h-9 px-3 rounded-lg border border-border bg-background text-xs focus:ring-1 focus:ring-primary"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
          />
          <div className="flex flex-wrap gap-1 mt-2">
            {INSTRUCTION_PRESETS.map((inst) => (
              <button
                key={inst}
                type="button"
                className="text-[10px] px-2 py-0.5 rounded bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setInstruction(inst)}
              >
                + {inst}
              </button>
            ))}
          </div>
        </div>
      </div>

      <DialogFooter className="flex items-center justify-between sm:justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="text-muted-foreground hover:text-destructive text-xs"
        >
          Clear Date
        </Button>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            className="bg-primary text-primary-foreground gap-1.5"
          >
            <Check size={14} /> Set Next Visit
          </Button>
        </div>
      </DialogFooter>
    </Dialog>
  );
}
