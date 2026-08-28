import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Combina clases CSS con soporte para condicionales (clsx)
 * y resolución de conflictos de Tailwind (tailwind-merge).
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
