export default function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-700 rounded-full animate-spin" />
      <p className="mt-3 text-gray-500 text-sm">Cargando...</p>
    </div>
  );
}
