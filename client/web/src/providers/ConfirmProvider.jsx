import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../components/ui/dialog.jsx';
import { Button } from '../components/ui/button.jsx';

const ConfirmContext = createContext(null);

/**
 * App-wide confirmation dialog (FET-02's "Confirmation dialogs"
 * deliverable). `confirm({ title, description, variant })` returns a
 * Promise<boolean> — e.g. destructive actions like removing a
 * gynecology sub-record can `if (!(await confirm({...}))) return;`
 * before calling the real delete endpoint, instead of every module
 * building its own yes/no modal.
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { title, description, confirmLabel, cancelLabel, variant, resolve }

  const confirm = useCallback(
    ({ title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'default' }) =>
      new Promise((resolve) => {
        setState({ title, description, confirmLabel, cancelLabel, variant, resolve });
      }),
    [],
  );

  const handleClose = useCallback(
    (result) => {
      state?.resolve(result);
      setState(null);
    },
    [state],
  );

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog open={Boolean(state)} onOpenChange={(open) => !open && handleClose(false)}>
        {state ? (
          <>
            <DialogHeader>
              <div
                className={
                  state.variant === 'destructive'
                    ? 'mb-1 grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-destructive'
                    : 'mb-1 grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-foreground'
                }
                aria-hidden="true"
              >
                {state.variant === 'destructive' ? <AlertTriangle size={18} /> : <HelpCircle size={18} />}
              </div>
              <DialogTitle>{state.title}</DialogTitle>
              {state.description ? <DialogDescription>{state.description}</DialogDescription> : null}
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                autoFocus={state.variant === 'destructive'}
                onClick={() => handleClose(false)}
              >
                {state.cancelLabel}
              </Button>
              <Button
                variant={state.variant === 'destructive' ? 'destructive' : 'default'}
                size="sm"
                autoFocus={state.variant !== 'destructive'}
                onClick={() => handleClose(true)}
              >
                {state.confirmLabel}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within a ConfirmProvider');
  return ctx.confirm;
}
