import { useEffect, useState } from 'react';
import { Pill, Plus } from 'lucide-react';

import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogCloseButton, DialogFooter } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';
import { MedicineRowItem, createEmptyMedicineItem } from './MedicineRxBuilder.jsx';

/**
 * Every place a medicine gets added to a prescription — the document's
 * own "+ Add medicine line", or picking one from DrugHistoryPanel —
 * routes through this single dialog, so the doctor always fills in
 * (or reviews) a medicine via the same structured entry UI
 * (MedicineRowItem: brand search, dosage-pattern quick buttons, food/
 * duration/continuation selects, live preview line) instead of typing
 * directly into the small print-styled document or having a drug
 * silently appended without a chance to adjust it first.
 *
 * `initialItem` is optional — omit it (or pass null) for a blank new
 * line; pass a drug-history entry to prefill the form for review
 * before it's added.
 */
export default function AddMedicineDialog({ open, onOpenChange, initialItem, onAdd, nextSerialNumber = 1 }) {
  const [draft, setDraft] = useState(() => initialItem || createEmptyMedicineItem(nextSerialNumber));

  // Reset the draft each time the dialog is (re)opened, rather than on
  // every prop change — so edits the doctor makes inside the dialog
  // aren't clobbered by an unrelated re-render of the parent page
  // while it's open.
  useEffect(() => {
    if (open) {
      setDraft(initialItem ? { ...initialItem, serialNumber: nextSerialNumber } : createEmptyMedicineItem(nextSerialNumber));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isPrefilled = Boolean(initialItem);
  const hasContent = Boolean(draft.brandName || draft.medicineName || draft.genericName);

  const handleConfirm = () => {
    onAdd?.(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-3xl">
      <DialogCloseButton onClose={() => onOpenChange(false)} />
      <DialogHeader>
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-primary/10 text-primary">
            <Pill size={18} />
          </div>
          <div>
            <DialogTitle>{isPrefilled ? 'Add from Drug History' : 'New Medicine Item'}</DialogTitle>
            <DialogDescription>
              {isPrefilled
                ? 'Review or adjust before adding this to the current prescription.'
                : 'Search the brand/generic database, or type a fully custom medicine.'}
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="py-2">
        <MedicineRowItem
          item={draft}
          index={0}
          total={1}
          disabled={false}
          hideListActions
          onChange={setDraft}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={handleConfirm} disabled={!hasContent}>
          <Plus size={14} /> Add to Prescription
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
