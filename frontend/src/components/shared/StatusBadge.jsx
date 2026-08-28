import { CheckCircle2, XCircle } from 'lucide-react';

export default function StatusBadge({ value }) {
  if (value) {
    return <CheckCircle2 size={18} className="text-green-600" />;
  }
  return <XCircle size={18} className="text-red-500" />;
}
