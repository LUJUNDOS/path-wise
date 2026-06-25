import { create } from 'zustand';
import type {
  Destination,
  TravelerGroup,
  TripPreferences,
  BudgetLevel,
  PaceLevel,
  TimePeriod,
  TransportType,
} from '@path-wise/shared';

interface TripFormState {
  // Form fields
  departureCity: string;
  destinations: Destination[];
  departureDate: string;
  timePeriod: TimePeriod;
  travelers: TravelerGroup;
  preferences: TripPreferences;
  showPreferences: boolean;
  needsReturnTransport: boolean;
  returnTransportPref: TransportType | 'auto';

  // Actions
  setDepartureCity: (city: string) => void;
  addDestination: (cityName: string, days?: number) => void;
  removeDestination: (index: number) => void;
  updateDestinationDays: (index: number, days: number) => void;
  updateDestinationTransport: (index: number, transport: TransportType | null) => void;
  reorderDestinations: (fromIndex: number, toIndex: number) => void;
  setDepartureDate: (date: string) => void;
  setTimePeriod: (period: TimePeriod) => void;
  setAdults: (count: number) => void;
  setChildren: (children: { age: number }[]) => void;
  setElders: (count: number) => void;
  setBudget: (budget: BudgetLevel) => void;
  setPace: (pace: PaceLevel) => void;
  setAccommodation: (accommodation: string) => void;
  setInterests: (interests: string[]) => void;
  setDining: (dining: string[]) => void;
  setNeedsReturnTransport: (needs: boolean) => void;
  setReturnTransportPref: (pref: TransportType | 'auto') => void;
  togglePreferences: () => void;
  resetForm: () => void;
}

const DEFAULT_PREFERENCES: TripPreferences = {
  budget: 'comfort',
  pace: 'moderate',
  accommodation: 'chain_hotel',
  dining: [],
  interests: [],
};

const getToday = (): string => {
  return new Date().toISOString().slice(0, 10);
};

export const useTripFormStore = create<TripFormState>((set) => ({
  departureCity: '',
  destinations: [],
  departureDate: getToday(),
  timePeriod: 'morning',
  travelers: { adults: 1, children: [], elders: 0 },
  preferences: { ...DEFAULT_PREFERENCES },
  showPreferences: false,
  needsReturnTransport: true, // 默认勾选
  returnTransportPref: 'auto',

  setDepartureCity: (city: string) => set({ departureCity: city }),

  addDestination: (cityName: string, days = 2) =>
    set((state) => ({
      destinations: [...state.destinations, { cityName, days, transportTo: null }],
    })),

  removeDestination: (index: number) =>
    set((state) => ({
      destinations: state.destinations.filter((_, i) => i !== index),
    })),

  updateDestinationDays: (index: number, days: number) =>
    set((state) => ({
      destinations: state.destinations.map((d, i) => (i === index ? { ...d, days } : d)),
    })),

  updateDestinationTransport: (index: number, transport: TransportType | null) =>
    set((state) => ({
      destinations: state.destinations.map((d, i) =>
        i === index ? { ...d, transportTo: transport } : d,
      ),
    })),

  reorderDestinations: (fromIndex: number, toIndex: number) =>
    set((state) => {
      const newDest = [...state.destinations];
      const [removed] = newDest.splice(fromIndex, 1);
      newDest.splice(toIndex, 0, removed);
      return { destinations: newDest };
    }),

  setDepartureDate: (date: string) => set({ departureDate: date }),
  setTimePeriod: (period: TimePeriod) => set({ timePeriod: period }),

  setAdults: (count: number) =>
    set((state) => ({
      travelers: { ...state.travelers, adults: count },
    })),

  setChildren: (children: { age: number }[]) =>
    set((state) => ({
      travelers: { ...state.travelers, children },
    })),

  setElders: (count: number) =>
    set((state) => ({
      travelers: { ...state.travelers, elders: count },
    })),

  setBudget: (budget: BudgetLevel) =>
    set((state) => ({
      preferences: { ...state.preferences, budget },
    })),

  setPace: (pace: PaceLevel) =>
    set((state) => ({
      preferences: { ...state.preferences, pace },
    })),

  setAccommodation: (accommodation: string) =>
    set((state) => ({
      preferences: { ...state.preferences, accommodation },
    })),

  setInterests: (interests: string[]) =>
    set((state) => ({
      preferences: { ...state.preferences, interests },
    })),

  setDining: (dining: string[]) =>
    set((state) => ({
      preferences: { ...state.preferences, dining },
    })),

  setNeedsReturnTransport: (needsReturnTransport: boolean) => set({ needsReturnTransport }),

  setReturnTransportPref: (returnTransportPref: TransportType | 'auto') =>
    set({ returnTransportPref }),

  togglePreferences: () => set((state) => ({ showPreferences: !state.showPreferences })),

  resetForm: () =>
    set({
      departureCity: '',
      destinations: [],
      departureDate: getToday(),
      timePeriod: 'morning',
      travelers: { adults: 1, children: [], elders: 0 },
      preferences: { ...DEFAULT_PREFERENCES },
      showPreferences: false,
      needsReturnTransport: true,
      returnTransportPref: 'auto',
    }),
}));
