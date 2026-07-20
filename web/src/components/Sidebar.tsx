import { Folder, LayoutDashboard, Star } from "lucide-react";
import { useApp } from "../context/AppContext";
import type { AppPage } from "../types";

interface SidebarProps {
    activePage: AppPage;
    expanded: boolean;
}

const sections = [
    { page: "projects", icon: Folder, label: "Projects" },
    { page: "dashboards", icon: LayoutDashboard, label: "Dashboard" },
    { page: "favourites", icon: Star, label: "Favourites" },
] as const;

export function Sidebar({ activePage, expanded }: SidebarProps) {
    const { setActivePage } = useApp();

    return (
        <aside className={`shrink-0 overflow-hidden border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ${expanded ? "w-48 border-l" : "w-0 border-l-0"}`} aria-hidden={!expanded}>
            {expanded && (
            <div className="flex h-full w-48 flex-col p-3">
                <p className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Navigation</p>
                <nav aria-label="Fallback navigation" className="flex min-w-0 flex-col gap-1">
                    {sections.map(({ page, icon: Icon, label }) => {
                        const active = activePage === page;
                        return (
                            <button
                                key={page}
                                type="button"
                                onClick={() => setActivePage(page)}
                                aria-current={active ? "page" : undefined}
                                className={`flex h-9 min-w-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"}`}
                            >
                                <Icon className={`h-4 w-4 shrink-0 ${active ? "text-primary" : ""}`} aria-hidden="true" />
                                <span className="truncate">{label}</span>
                            </button>
                        );
                    })}
                </nav>
                <p className="mt-auto px-2 text-[11px] leading-relaxed text-muted-foreground">Settings and application actions remain in the system menu.</p>
            </div>
            )}
        </aside>
    );
}
