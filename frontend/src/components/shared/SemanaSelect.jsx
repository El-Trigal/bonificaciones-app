import { useEffect, useState } from 'react';
import api from '../../store/api';
import { useAppStore } from '../../store/appStore';

let cache = null;
let cargando = null;

async function cargarSemanas() {
  if (cache) return cache;
  if (!cargando) cargando = api.get('/catalogos/semanas').then(({ data }) => {
    cache = data.slice().sort((a, b) => b.codigo.localeCompare(a.codigo));
    return cache;
  });
  return cargando;
}

export function invalidarCacheSemanas() { cache = null; cargando = null; }

/**
 * Select global de semanas. Sincroniza con appStore.selectedSemana:
 * cualquier cambio en una página se refleja en las demás.
 *
 * Props:
 *  - value / onChange: control local (ambos opcionales; si faltan usa el store)
 *  - allowEmpty: muestra opción "— Todas —" (para filtros)
 *  - syncGlobal: default true. Si false, no escribe al store.
 *  - className: estilos extra
 */
export default function SemanaSelect({
  value,
  onChange,
  allowEmpty = false,
  syncGlobal = true,
  className = '',
  autoPick = true,
}) {
  const [semanas, setSemanas] = useState(cache || []);
  const selectedGlobal = useAppStore((s) => s.selectedSemana);
  const setGlobal = useAppStore((s) => s.setSelectedSemana);

  useEffect(() => {
    cargarSemanas().then(setSemanas);
  }, []);

  // Al montar: si no hay valor local pero sí global, prellenar vía onChange.
  useEffect(() => {
    if (autoPick && !value && selectedGlobal && onChange) {
      onChange(selectedGlobal);
    }
  }, []); // solo al montar

  const handle = (v) => {
    onChange?.(v);
    if (syncGlobal && v) setGlobal(v);
  };

  return (
    <select
      value={value || ''}
      onChange={(e) => handle(e.target.value)}
      className={`px-3 py-2 border border-gray-300 rounded-lg bg-white ${className}`}
    >
      {allowEmpty && <option value="">— Todas —</option>}
      {!value && !allowEmpty && <option value="" disabled>Selecciona semana…</option>}
      {semanas.map((s) => (
        <option key={s.codigo} value={s.codigo}>
          {s.codigo}{s.tiene_festivo ? ' ·  festivo' : ''}
        </option>
      ))}
    </select>
  );
}
