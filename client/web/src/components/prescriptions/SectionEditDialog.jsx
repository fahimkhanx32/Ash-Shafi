import { Dialog, DialogHeader, DialogTitle, DialogDescription, DialogCloseButton, DialogFooter } from '../ui/dialog.jsx';
import { Button } from '../ui/button.jsx';

/**
 * Every clickable section on the live Rx document (Vitals, Diagnoses,
 * Investigations, Advice) opens through this one dialog shell,
 * wrapping the EXACT SAME builder component already used in the
 * left-panel editor (VitalsEditor / DiagnosisBuilder /
 * InvestigationBuilder / AdviceBuilder) — never a re-typed or
 * simplified copy of that UI. Unlike AddMedicineDialog, there is no
 * draft/confirm step here: these builders already call `onChange`
 * live against `form` as the doctor interacts, exactly as they do in
 * the left panel, so this dialog is just a "Done" close, not a
 * separate commit.
 */
export default function SectionEditDialog({ open, onOpenChange, icon, title, description, children }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-3xl">
      <DialogCloseButton onClose={() => onOpenChange(false)} />
      <DialogHeader>
        <div className="flex items-center gap-2">
          {icon ? <div className="p-2 rounded-xl bg-primary/10 text-primary">{icon}</div> : null}
          <div>
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </div>
        </div>
      </DialogHeader>

      <div className="py-2 max-h-[65vh] overflow-y-auto">
        {children}
      </div>

      <DialogFooter>
        <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
          Done
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
