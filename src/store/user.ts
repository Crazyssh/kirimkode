import { create } from "zustand";

interface UserData {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  phone: string | null;
  phoneVerified: boolean;
  balance: number;
  role: string;
  apiKey: string | null;
  webhookUrl: string | null;
  favorites: string;
  favoriteCountries: string;
  theme: string;
}

interface UserStore {
  user: UserData | null;
  loading: boolean;
  fetchUser: () => Promise<void>;
  updateBalance: (balance: number) => void;
  reset: () => void;
}

export const useUserStore = create<UserStore>((set, get) => ({
  user: null,
  loading: true,
  fetchUser: async () => {
    const current = get().user;
    // Only show loading on first load (no existing data)
    if (!current) set({ loading: true });

    // Retry up to 3 times with delay
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`/api/user/me?_t=${Date.now()}`, {
          cache: "no-store",
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          if (data.data) {
            set({ user: data.data, loading: false });
            return;
          }
        }
        // 401 = session not ready yet, retry after delay
        if (res.status === 401 && attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
      } catch {
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
      }
      break;
    }
    // Only clear user if we never had data (first load failed)
    if (!current) set({ loading: false });
    else set({ loading: false });
  },
  updateBalance: (balance) =>
    set((state) => ({
      user: state.user ? { ...state.user, balance } : null,
    })),
  reset: () => set({ user: null, loading: false }),
}));
