"use client"

import { useState, useEffect } from "react"
import { syncManager } from "@/lib/offline-sync"

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    // Initialize sync manager
    syncManager.init()

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Check initial state
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  useEffect(() => {
    // Update pending count
    const updateCount = async () => {
      const count = await syncManager.getPendingCount()
      setPendingCount(count)
    }

    updateCount()
    const interval = setInterval(updateCount, 5000) // Update every 5 seconds

    return () => clearInterval(interval)
  }, [])

  return {
    isOnline,
    pendingCount,
  }
}
