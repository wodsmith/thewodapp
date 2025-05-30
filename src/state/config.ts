import { create } from 'zustand'
import { combine } from 'zustand/middleware'

export const useConfigStore = create(
  combine(
    {
      isGoogleSSOEnabled: false,
      isTurnstileEnabled: false,
    },
    (set) => ({
      setConfig: (config: { isGoogleSSOEnabled: boolean, isTurnstileEnabled: boolean }) => {
        set({
          isGoogleSSOEnabled: config.isGoogleSSOEnabled,
          isTurnstileEnabled: config.isTurnstileEnabled,
        })
      },
    })
  )
)
