import { create } from 'zustand'
import { combine } from 'zustand/middleware'

export const useNavStore = create(
  combine(
    {
      isOpen: false,
    },
    (set) => ({
      setIsOpen: (isOpen: boolean) => set({ isOpen }),
    })
  )
)
