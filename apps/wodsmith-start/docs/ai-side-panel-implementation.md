# Workbench Side Panel Implementation Plan

A flexible side panel system for Wodsmith organizers. The panel supports multiple tabs (AI Assistant, Docs, Actions, etc.) with AI being the first implementation.

## Visual Structure

```
CLOSED STATE:
┌──────────┬──────────────────────────────────────────────────┬─────┐
│ Left Nav │              Main Content                        │Icons│
│          │              (full width)                        │ 🤖  │
│          │                                                  │ 📚  │
│          │                                                  │ ⚡  │
└──────────┴──────────────────────────────────────────────────┴─────┘
                                                               ↑
                                                          Far right

OPEN STATE:
┌──────────┬──────────────────────┬─────┬─────────────────────────┐
│ Left Nav │    Main Content      │Icons│   Panel Content         │
│          │    (shrinks)         │ 🤖  │   (Active Tab)          │
│          │                      │ 📚  │                         │
│          │                      │ ⚡  │                         │
└──────────┴──────────────────────┴─────┴─────────────────────────┘
                                   ↑
                            Pushed left!
```

**Key behavior:** The icon strip + panel are one unit. Icons are always the LEFT edge of that unit.
- **Closed**: Unit is just the icon strip, docked to far right
- **Open**: Unit expands (icons + content), icons stay as left edge
- **Resize**: Drag the LEFT edge of the panel to adjust width

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    WorkbenchProvider                         │
│  (Context for panel state, available everywhere)            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              WorkbenchPanel                          │    │
│  │  ┌──────────┬────────────────────────────────────┐  │    │
│  │  │ IconStrip│         Content Area               │  │    │
│  │  │          │  ┌──────────────────────────────┐  │  │    │
│  │  │  [🤖]    │  │  WorkbenchPanelHeader        │  │  │    │
│  │  │  [📚]    │  ├──────────────────────────────┤  │  │    │
│  │  │  [⚡]    │  │                              │  │  │    │
│  │  │          │  │  Active Tab Content          │  │  │    │
│  │  │          │  │  (AIPanel / DocsPanel / etc) │  │  │    │
│  │  │          │  │                              │  │  │    │
│  │  │  [+]     │  │                              │  │  │    │
│  │  └──────────┴──┴──────────────────────────────┘  │  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Tab System Design

Tabs are defined as a registry that can be extended:

```typescript
// Each tab has:
interface WorkbenchTab {
  id: string                           // Unique identifier
  label: string                        // Display name for header
  icon: LucideIcon                     // Icon for the strip
  component: React.ComponentType       // The panel content
  tooltip?: string                     // Optional tooltip text
}

// Initial tabs:
const WORKBENCH_TABS: WorkbenchTab[] = [
  {
    id: "ai",
    label: "AI Assistant",
    icon: Bot,
    component: AIPanel,
    tooltip: "AI Assistant",
  },
  // Future tabs:
  // { id: "docs", label: "Documentation", icon: BookOpen, component: DocsPanel },
  // { id: "actions", label: "Quick Actions", icon: Zap, component: ActionsPanel },
]
```

---

## Files to Create

### 1. State Management

**`src/state/workbench.ts`** - Zustand store for workbench state

```typescript
import { create } from "zustand"
import { persist } from "zustand/middleware"

interface WorkbenchState {
  /** Whether the side panel is open */
  isOpen: boolean
  /** Panel width in pixels */
  width: number
  /** Currently active tab ID */
  activeTabId: string | null
  /** Whether the panel is currently being resized */
  isResizing: boolean

  // Actions
  open: (tabId?: string) => void
  close: () => void
  toggle: (tabId?: string) => void
  setWidth: (width: number) => void
  setActiveTab: (tabId: string) => void
  setIsResizing: (isResizing: boolean) => void
}

const DEFAULT_WIDTH = 420
const MIN_WIDTH = 320
const MAX_WIDTH = 800
const CLOSE_THRESHOLD = 200

export const useWorkbenchStore = create<WorkbenchState>()(
  persist(
    (set, get) => ({
      isOpen: false,
      width: DEFAULT_WIDTH,
      activeTabId: null,
      isResizing: false,

      open: (tabId) =>
        set({
          isOpen: true,
          activeTabId: tabId ?? get().activeTabId ?? "ai",
        }),

      close: () => set({ isOpen: false }),

      toggle: (tabId) => {
        const state = get()
        if (!state.isOpen) {
          // Opening - set tab and open
          set({
            isOpen: true,
            activeTabId: tabId ?? state.activeTabId ?? "ai",
          })
        } else if (tabId && tabId !== state.activeTabId) {
          // Already open but switching tabs
          set({ activeTabId: tabId })
        } else {
          // Already open on this tab - close
          set({ isOpen: false })
        }
      },

      setWidth: (width: number) => {
        if (width < CLOSE_THRESHOLD) {
          set({ isOpen: false, width: DEFAULT_WIDTH })
          return
        }
        const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width))
        set({ width: clampedWidth })
      },

      setActiveTab: (tabId) => set({ activeTabId: tabId, isOpen: true }),
      setIsResizing: (isResizing) => set({ isResizing }),
    }),
    {
      name: "workbench-storage",
      partialize: (state) => ({
        width: state.width,
        activeTabId: state.activeTabId,
      }),
    },
  ),
)

export { MIN_WIDTH, MAX_WIDTH, DEFAULT_WIDTH, CLOSE_THRESHOLD }
```

---

### 2. Tab Registry

**`src/components/workbench/tabs.tsx`** - Tab definitions

```typescript
import type { LucideIcon } from "lucide-react"
import { Bot } from "lucide-react"
import { AIPanel } from "@/components/workbench/panels/ai-panel"

export interface WorkbenchTab {
  /** Unique identifier for the tab */
  id: string
  /** Display label shown in header */
  label: string
  /** Icon shown in the icon strip */
  icon: LucideIcon
  /** Component to render as panel content */
  component: React.ComponentType
  /** Tooltip text for icon (defaults to label) */
  tooltip?: string
}

/**
 * Registry of available workbench tabs.
 *
 * To add a new tab:
 * 1. Create the panel component in src/components/workbench/panels/
 * 2. Add an entry here with id, label, icon, and component
 */
export const WORKBENCH_TABS: WorkbenchTab[] = [
  {
    id: "ai",
    label: "AI Assistant",
    icon: Bot,
    component: AIPanel,
    tooltip: "AI Assistant",
  },
  // Future tabs:
  // {
  //   id: "docs",
  //   label: "Documentation",
  //   icon: BookOpen,
  //   component: DocsPanel,
  //   tooltip: "Help & Docs",
  // },
  // {
  //   id: "actions",
  //   label: "Quick Actions",
  //   icon: Zap,
  //   component: ActionsPanel,
  //   tooltip: "Quick Actions",
  // },
]

/**
 * Get a tab by ID
 */
export function getTabById(id: string): WorkbenchTab | undefined {
  return WORKBENCH_TABS.find((tab) => tab.id === id)
}
```

---

### 3. Main Workbench Panel Component

**`src/components/workbench/workbench-panel.tsx`** - The container component

```typescript
"use client"

import { useCallback, useEffect, useRef } from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useWorkbenchStore } from "@/state/workbench"
import { WORKBENCH_TABS, getTabById } from "./tabs"

/**
 * Workbench Side Panel
 *
 * A flexible side panel with tab-based navigation.
 * Icon strip on the left, content area on the right.
 * Supports resize by dragging the left edge.
 */
export function WorkbenchPanel() {
  const {
    isOpen,
    width,
    activeTabId,
    isResizing,
    toggle,
    close,
    setWidth,
    setActiveTab,
    setIsResizing,
  } = useWorkbenchStore()

  const panelRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const startWidthRef = useRef(0)

  // Get active tab config
  const activeTab = activeTabId ? getTabById(activeTabId) : null
  const ActiveComponent = activeTab?.component

  // Handle resize drag
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      setIsResizing(true)
      startXRef.current = e.clientX
      startWidthRef.current = width
    },
    [width, setIsResizing],
  )

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return
      // Dragging LEFT increases width (panel expands left)
      const delta = startXRef.current - e.clientX
      const newWidth = startWidthRef.current + delta
      setWidth(newWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
    }

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.userSelect = "none"
      document.body.style.cursor = "ew-resize"
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.body.style.userSelect = ""
      document.body.style.cursor = ""
    }
  }, [isResizing, setWidth, setIsResizing])

  return (
    <div
      ref={panelRef}
      className={cn(
        "fixed top-0 right-0 h-full z-40 flex",
        "transition-all duration-200 ease-in-out",
        isResizing && "transition-none",
      )}
      style={{
        width: isOpen ? width + 48 : 48, // 48px for icon strip
      }}
    >
      {/* Resize Handle - only visible when open */}
      {isOpen && (
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize",
            "hover:bg-primary/20 active:bg-primary/30",
            "transition-colors z-10",
            isResizing && "bg-primary/30",
          )}
          onMouseDown={handleMouseDown}
        />
      )}

      {/* Icon Strip - LEFT edge of the panel unit */}
      <div className="w-12 bg-muted/50 border-l flex flex-col items-center py-2 gap-1 shrink-0">
        {WORKBENCH_TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = isOpen && activeTabId === tab.id

          return (
            <Tooltip key={tab.id}>
              <TooltipTrigger asChild>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="icon"
                  className="h-10 w-10"
                  onClick={() => toggle(tab.id)}
                >
                  <Icon className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">
                {tab.tooltip ?? tab.label}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      {/* Panel Content - RIGHT of icon strip */}
      {isOpen && activeTab && ActiveComponent && (
        <div
          className="flex-1 bg-background border-l flex flex-col overflow-hidden"
          style={{ width }}
        >
          {/* Header */}
          <div className="h-14 border-b flex items-center justify-between px-4 shrink-0">
            <h2 className="font-semibold">{activeTab.label}</h2>
            <Button variant="ghost" size="icon" onClick={close}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden">
            <ActiveComponent />
          </div>
        </div>
      )}
    </div>
  )
}
```

---

### 4. AI Panel (First Tab Implementation)

**`src/components/workbench/panels/ai-panel.tsx`** - AI assistant tab content

```typescript
"use client"

import { useState, useCallback, useEffect } from "react"
import type { UIMessage } from "@ai-sdk/react"
import { Button } from "@/components/ui/button"
import { History, MessageSquarePlus, ArrowLeft } from "lucide-react"
import { AIChat } from "@/components/ai-chat"
import { cn } from "@/lib/utils"

type View = "chat" | "history"

interface Thread {
  id: string
  title: string | null
  createdAt: string
  updatedAt: string
}

/**
 * AI Assistant Panel
 *
 * Provides chat interface with conversation history.
 * Can switch between active chat and history list views.
 */
export function AIPanel() {
  const [view, setView] = useState<View>("chat")
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [initialMessages, setInitialMessages] = useState<UIMessage[] | undefined>()
  const [isLoadingThread, setIsLoadingThread] = useState(false)

  // Load thread messages when activeThreadId changes
  useEffect(() => {
    if (activeThreadId) {
      loadThread(activeThreadId)
    } else {
      setInitialMessages(undefined)
    }
  }, [activeThreadId])

  const loadThread = async (threadId: string) => {
    setIsLoadingThread(true)
    try {
      const res = await fetch(`/api/ai/threads/${threadId}`)
      if (!res.ok) {
        setActiveThreadId(null)
        return
      }

      const data = (await res.json()) as {
        messages: Array<{ id: string; role: string; content: string }>
      }

      const uiMessages: UIMessage[] = data.messages.map((msg) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant",
        parts: [{ type: "text" as const, text: msg.content }],
      }))

      setInitialMessages(uiMessages)
    } catch (error) {
      console.error("Error loading thread:", error)
    } finally {
      setIsLoadingThread(false)
    }
  }

  const handleThreadChange = useCallback((threadId: string) => {
    setActiveThreadId(threadId)
  }, [])

  const handleSelectThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId)
    setView("chat")
  }, [])

  const handleNewChat = useCallback(() => {
    setActiveThreadId(null)
    setInitialMessages(undefined)
    setView("chat")
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Sub-navigation bar */}
      <div className="h-10 border-b flex items-center px-2 gap-1 shrink-0 bg-muted/30">
        {view === "history" ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => setView("chat")}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Chat
          </Button>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={handleNewChat}
            >
              <MessageSquarePlus className="h-4 w-4 mr-1" />
              New
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => setView("history")}
            >
              <History className="h-4 w-4 mr-1" />
              History
            </Button>
          </>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {view === "chat" ? (
          isLoadingThread ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-muted-foreground">Loading conversation...</div>
            </div>
          ) : (
            <AIChat
              key={activeThreadId ?? "new"}
              threadId={activeThreadId ?? undefined}
              initialMessages={initialMessages}
              onThreadChange={handleThreadChange}
            />
          )
        ) : (
          <AIHistoryList
            activeThreadId={activeThreadId}
            onSelectThread={handleSelectThread}
          />
        )}
      </div>
    </div>
  )
}

/**
 * History list sub-component
 */
function AIHistoryList({
  activeThreadId,
  onSelectThread,
}: {
  activeThreadId: string | null
  onSelectThread: (threadId: string) => void
}) {
  const [threads, setThreads] = useState<Thread[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchThreads = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/ai/threads")
      if (!res.ok) throw new Error("Failed to load conversations")
      const data = (await res.json()) as { threads?: Thread[] }
      setThreads(data.threads ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchThreads()
  }, [fetchThreads])

  const deleteThread = useCallback(
    async (threadId: string, e: React.MouseEvent) => {
      e.stopPropagation()
      setThreads((prev) => prev.filter((t) => t.id !== threadId))

      try {
        await fetch(`/api/ai/threads/${threadId}`, { method: "DELETE" })
      } catch {
        fetchThreads()
      }
    },
    [fetchThreads],
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        <div className="text-destructive text-sm">{error}</div>
        <Button variant="outline" size="sm" onClick={fetchThreads}>
          Retry
        </Button>
      </div>
    )
  }

  if (threads.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground text-sm text-center">
          No conversations yet.
          <br />
          Start a new chat to begin.
        </div>
      </div>
    )
  }

  return (
    <div className="p-2 space-y-1 overflow-y-auto h-full">
      {threads.map((thread) => (
        <div
          key={thread.id}
          className={cn(
            "group flex items-center gap-2 p-2 rounded-md cursor-pointer transition-colors",
            "hover:bg-accent",
            activeThreadId === thread.id && "bg-accent",
          )}
          onClick={() => onSelectThread(thread.id)}
          role="button"
          tabIndex={0}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {thread.title ?? `Chat from ${new Date(thread.createdAt).toLocaleDateString()}`}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(thread.updatedAt).toLocaleDateString()}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100"
            onClick={(e) => deleteThread(thread.id, e)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  )
}
```

---

### 5. Layout Wrapper Component

**`src/components/workbench/workbench-layout.tsx`** - Wraps content to account for panel

```typescript
"use client"

import { useWorkbenchStore } from "@/state/workbench"
import { WorkbenchPanel } from "./workbench-panel"
import { cn } from "@/lib/utils"

interface WorkbenchLayoutProps {
  children: React.ReactNode
  className?: string
}

/**
 * Layout wrapper that adjusts main content when workbench panel is open.
 *
 * Use this to wrap your main content area. It will:
 * 1. Render the workbench side panel
 * 2. Add right margin to main content when panel is open
 */
export function WorkbenchLayout({ children, className }: WorkbenchLayoutProps) {
  const { isOpen, width, isResizing } = useWorkbenchStore()

  return (
    <>
      {/* Main content with dynamic margin */}
      <div
        className={cn(
          "transition-[margin] duration-200 ease-in-out",
          isResizing && "transition-none",
          className,
        )}
        style={{
          marginRight: isOpen ? width + 48 : 48, // 48px for icon strip
        }}
      >
        {children}
      </div>

      {/* Workbench Panel */}
      <WorkbenchPanel />
    </>
  )
}
```

---

### 6. Export Barrel

**`src/components/workbench/index.ts`** - Clean exports

```typescript
export { WorkbenchPanel } from "./workbench-panel"
export { WorkbenchLayout } from "./workbench-layout"
export { WORKBENCH_TABS, getTabById, type WorkbenchTab } from "./tabs"
```

---

## Directory Structure

```
src/
├── state/
│   └── workbench.ts                 # Zustand store
│
└── components/
    └── workbench/
        ├── index.ts                 # Barrel exports
        ├── tabs.tsx                 # Tab registry
        ├── workbench-panel.tsx      # Main panel container
        ├── workbench-layout.tsx     # Layout wrapper
        │
        └── panels/                  # Tab content components
            ├── ai-panel.tsx         # AI Assistant (first tab)
            ├── docs-panel.tsx       # Future: Documentation
            └── actions-panel.tsx    # Future: Quick Actions
```

---

## Integration

### Update CompetitionSidebar

Modify `src/components/competition-sidebar.tsx`:

```typescript
import { WorkbenchLayout } from "@/components/workbench"

export function CompetitionSidebar({
  competitionId,
  children,
}: CompetitionSidebarProps) {
  // ... existing code ...

  return (
    <SidebarProvider>
      <Sidebar variant="sidebar" collapsible="icon">
        {/* ... sidebar content ... */}
      </Sidebar>
      <SidebarInset>
        <WorkbenchLayout>{children}</WorkbenchLayout>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

---

## Adding New Tabs (Future)

To add a new tab:

1. **Create the panel component:**

```typescript
// src/components/workbench/panels/docs-panel.tsx
export function DocsPanel() {
  return (
    <div className="p-4">
      <h3>Documentation</h3>
      {/* Panel content */}
    </div>
  )
}
```

2. **Register in tabs.tsx:**

```typescript
import { BookOpen } from "lucide-react"
import { DocsPanel } from "./panels/docs-panel"

export const WORKBENCH_TABS: WorkbenchTab[] = [
  // ... existing tabs
  {
    id: "docs",
    label: "Documentation",
    icon: BookOpen,
    component: DocsPanel,
    tooltip: "Help & Docs",
  },
]
```

That's it! The new tab will automatically appear in the icon strip.

---

## Potential Future Tabs

| Tab ID | Label | Icon | Use Case |
|--------|-------|------|----------|
| `ai` | AI Assistant | Bot | Chat with competition planner AI |
| `docs` | Documentation | BookOpen | Contextual help and guides |
| `actions` | Quick Actions | Zap | Common actions for current page |
| `notes` | Notes | StickyNote | Scratchpad for organizer notes |
| `checklist` | Checklist | CheckSquare | Competition setup checklist |
| `timeline` | Timeline | Clock | Competition day timeline view |

---

## Keyboard Shortcuts (Future)

```typescript
// Global shortcuts
Cmd/Ctrl + \     // Toggle workbench panel
Cmd/Ctrl + 1     // Open AI tab
Cmd/Ctrl + 2     // Open Docs tab
Escape           // Close panel
```

---

## Implementation Order

1. **Create `src/state/workbench.ts`** - State management
2. **Create `src/components/workbench/tabs.tsx`** - Tab registry
3. **Create `src/components/workbench/panels/ai-panel.tsx`** - First tab
4. **Create `src/components/workbench/workbench-panel.tsx`** - Main container
5. **Create `src/components/workbench/workbench-layout.tsx`** - Layout wrapper
6. **Create `src/components/workbench/index.ts`** - Exports
7. **Update `src/components/competition-sidebar.tsx`** - Integration
8. **Test** - Resize, tab switching, persistence

---

## File Summary

| File | Purpose |
|------|---------|
| `src/state/workbench.ts` | Zustand store for panel state |
| `src/components/workbench/tabs.tsx` | Tab definitions registry |
| `src/components/workbench/workbench-panel.tsx` | Main panel with icon strip |
| `src/components/workbench/workbench-layout.tsx` | Layout wrapper for content |
| `src/components/workbench/panels/ai-panel.tsx` | AI assistant tab content |
| `src/components/workbench/index.ts` | Barrel exports |
