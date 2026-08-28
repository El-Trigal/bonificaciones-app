import { create } from 'zustand';

export const useAppStore = create((set) => ({
  selectedSemana: null,
  setSelectedSemana: (semana) => set({ selectedSemana: semana }),
  loading: false,
  setLoading: (loading) => set({ loading }),
}));
