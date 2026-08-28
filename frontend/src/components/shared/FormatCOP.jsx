export default function FormatCOP({ value }) {
  const num = Number(value) || 0;
  const formatted = '$' + Math.round(num).toLocaleString('es-CO');
  return <span>{formatted}</span>;
}

export function fmtCOP(value) {
  const num = Number(value) || 0;
  return '$' + Math.round(num).toLocaleString('es-CO');
}
