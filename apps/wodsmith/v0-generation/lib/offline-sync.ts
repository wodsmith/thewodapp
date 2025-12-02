"use client"

import type { Score, SyncQueueItem } from "./types"

const DB_NAME = "competition-scoring"
const DB_VERSION = 1
const STORE_NAME = "sync-queue"

/**
 * Offline-first sync manager using IndexedDB
 */
export class OfflineSyncManager {
  private db: IDBDatabase | null = null

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        this.db = request.result
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" })
          store.createIndex("timestamp", "timestamp", { unique: false })
        }
      }
    })
  }

  async addToQueue(score: Score): Promise<void> {
    if (!this.db) await this.init()

    const item: SyncQueueItem = {
      id: `${score.heatId}-${score.athleteId}-${Date.now()}`,
      score,
      timestamp: new Date(),
      retryCount: 0,
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.add(item)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getQueuedItems(): Promise<SyncQueueItem[]> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readonly")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async removeFromQueue(id: string): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(id)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async clearQueue(): Promise<void> {
    if (!this.db) await this.init()

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite")
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async getPendingCount(): Promise<number> {
    const items = await this.getQueuedItems()
    return items.length
  }
}

// Singleton instance
export const syncManager = new OfflineSyncManager()
