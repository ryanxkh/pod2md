"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useState } from "react"
import {
  AudioLines,
  ChevronLeft,
  ChevronRight,
  Library,
  List,
  Menu,
  Search,
  Settings,
  X,
} from "lucide-react"

const SIDEBAR_STORAGE_KEY = "pod2md:sidebar-collapsed"
const SIDEBAR_EXPANDED = 248
const SIDEBAR_COLLAPSED = 56

const NAV_ITEMS = [
  { href: "/", label: "Transcribe", icon: AudioLines, exact: true },
  { href: "/episodes", label: "Episodes", icon: List, exact: false },
  { href: "/collections", label: "Collections", icon: Library, exact: false },
] as const

function pageTitle(pathname: string): string {
  if (pathname === "/") return "Transcribe"
  if (pathname.startsWith("/episodes/") && pathname !== "/episodes") {
    return "Episode"
  }
  if (pathname === "/episodes") return "Episodes"
  if (pathname === "/collections") return "Collections"
  if (pathname === "/settings") return "Settings"
  return "pod2md"
}

function isNavActive(pathname: string, href: string, exact: boolean) {
  if (exact) return pathname === href
  if (href === "/episodes") {
    return pathname === "/episodes" || pathname.startsWith("/episodes/")
  }
  return pathname === href || pathname.startsWith(`${href}/`)
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true"
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next))
      return next
    })
  }, [])

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED
  const title = pageTitle(pathname)

  const navLink = (
    item: (typeof NAV_ITEMS)[number],
    onNavigate?: () => void,
  ) => {
    const active = isNavActive(pathname, item.href, item.exact)
    const Icon = item.icon
    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
        onClick={onNavigate}
        className={`flex items-center gap-3 rounded-[8px] px-3 py-2 text-sm transition-colors duration-150 ease-out ${focusRing} ${
          active
            ? "bg-accent-subtle text-fg"
            : "text-fg-secondary hover:bg-elevated hover:text-fg"
        } ${collapsed ? "justify-center px-2" : ""}`}
      >
        <Icon
          size={20}
          className={active ? "text-accent" : "shrink-0"}
          aria-hidden
        />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    )
  }

  const sidebarContent = (
    <>
      <div
        className={`flex items-center gap-2 border-b border-border px-4 py-4 ${collapsed ? "justify-center px-2" : ""}`}
      >
        <span
          className="h-2 w-2 shrink-0 rounded-[2px] bg-accent"
          aria-hidden
        />
        {!collapsed && (
          <span className="font-mono text-sm font-semibold tracking-tight text-fg">
            pod2md
          </span>
        )}
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-3">
        {NAV_ITEMS.map((item) => navLink(item, () => setMobileOpen(false)))}
      </nav>

      <div className="flex flex-col gap-1 border-t border-border p-3">
        <Link
          href="/settings"
          title={collapsed ? "Settings" : undefined}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 rounded-[8px] px-3 py-2 text-sm transition-colors duration-150 ease-out ${focusRing} ${
            pathname === "/settings"
              ? "bg-accent-subtle text-fg"
              : "text-fg-secondary hover:bg-elevated hover:text-fg"
          } ${collapsed ? "justify-center px-2" : ""}`}
        >
          <Settings
            size={20}
            className={
              pathname === "/settings" ? "text-accent" : "shrink-0"
            }
            aria-hidden
          />
          {!collapsed && <span>Settings</span>}
        </Link>
        <button
          type="button"
          onClick={toggleCollapsed}
          className={`hidden items-center gap-3 rounded-[8px] px-3 py-2 text-sm text-fg-secondary transition-colors duration-150 ease-out hover:bg-elevated hover:text-fg md:flex ${focusRing} ${
            collapsed ? "justify-center px-2" : ""
          }`}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight size={20} aria-hidden />
          ) : (
            <>
              <ChevronLeft size={20} aria-hidden />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </>
  )

  return (
    <div className="min-h-screen bg-bg">
      {/* Desktop sidebar */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-border bg-surface md:flex"
        style={{ width: sidebarWidth }}
        suppressHydrationWarning
      >
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-bg/80"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex h-full w-[248px] flex-col border-r border-border bg-surface">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className={`absolute right-3 top-4 rounded-[8px] p-1 text-fg-secondary hover:bg-elevated hover:text-fg ${focusRing}`}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      <div
        className="flex min-h-screen flex-col transition-[margin] duration-150 ease-out max-md:ml-0 md:ml-[var(--sidebar-margin)]"
        style={
          {
            "--sidebar-margin": `${sidebarWidth}px`,
          } as React.CSSProperties
        }
      >
        <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center justify-between border-b border-border bg-bg px-4 md:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className={`rounded-[8px] p-2 text-fg-secondary hover:bg-elevated hover:text-fg md:hidden ${focusRing}`}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-sm font-medium text-fg">{title}</h1>
          </div>
          <button
            type="button"
            onClick={() => {
              /* TODO(phase 3): open command palette */
            }}
            className={`flex items-center gap-2 rounded-[8px] border border-border px-2.5 py-1.5 text-xs text-fg-secondary transition-colors duration-150 ease-out hover:border-border-strong hover:bg-elevated hover:text-fg ${focusRing}`}
            aria-label="Command palette (coming soon)"
          >
            <Search size={14} aria-hidden />
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden rounded border border-border px-1.5 py-0.5 font-mono text-[10px] sm:inline">
              ⌘K
            </kbd>
          </button>
        </header>

        <main className="mx-auto w-full max-w-[880px] flex-1 px-4 py-8 md:px-8">
          {children}
        </main>
      </div>
    </div>
  )
}
