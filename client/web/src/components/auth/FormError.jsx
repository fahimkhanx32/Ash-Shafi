import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '../ui/alert.jsx';

export default function FormError({ message }) {
  if (!message) return null;
  return (
    <Alert variant="destructive" className="mb-5">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
