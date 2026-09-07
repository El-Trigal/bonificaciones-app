import { useEffect, useMemo, useState } from 'react';
import api from '../../store/api';
import { useAppStore } from '../../store/appStore';
import ComboBox from './ComboBox';

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
 * Selector de semanas con búsqueda por texto. Sincroniza con appStore.selectedSemana.
 *
 * Props:
 *  - value / onChange: control local
 *  - allowEmpty: muestra opción "— Todas —"
 *  - syncGlobal: default true
 *  - autoPick: default true — prellenar desde store si no hay valor local
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

  // Al montar: prellenar desde store si no hay valor local
  useEffect(() => {
    if (autoPick && !value && selectedGlobal && onChange) {
      onChange(selectedGlobal);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handle(v) {
    onChange?.(v);
    if (syncGlobal && v) setGlobal(v);
  }

  const opciones = useMemo(() => [
    ...(allowEmpty ? [{ value: '', label: '— Todas —' }] : []),
    ...semanas.map(s => ({
      value: s.codigo,
      label: s.codigo + (s.tiene_festivo ? ' · festivo' : ''),
    })),
  ], [semanas, allowEmpty]);

  // Texto a mostrar cuando hay una semana seleccionada
  const displayValue = useMemo(() => {
    if (!value) return '';
    const encontrada = semanas.find(s => s.codigo === value);
    if (!encontrada) return value;
    return encontrada.codigo + (encontrada.tiene_festivo ? ' · festivo' : '');
  }, [value, semanas]);

  return (
    <ComboBox
      placeholder="Buscar semana…"
      options={opciones}
      displayValue={displayValue}
      onSelect={opt => handle(opt?.value ?? '')}
      className={className}
    />
  );
}
