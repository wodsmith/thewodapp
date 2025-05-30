import { create } from "zustand";

interface TransactionStore {
  refreshTrigger: number;
  triggerRefresh: () => void;
}

export const useTransactionStore = create<TransactionStore>((set) => ({
  refreshTrigger: 0,
  triggerRefresh: () => set((state) => ({ refreshTrigger: state.refreshTrigger + 1 })),
}));
