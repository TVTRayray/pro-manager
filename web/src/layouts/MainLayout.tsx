import { useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { TitleBar } from "../components/TitleBar";
import { Window } from "@tauri-apps/api/window";
import type { AppPage } from "../types";

type ResizeDirection = Parameters<Window["startResizeDragging"]>[0];

const appWindow = (() => {
    try {
        return Window.getCurrent();
    } catch {
        return null;
    }
})();

const resizeHandles: Array<{ direction: ResizeDirection; className: string }> = [
    { direction: "North", className: "left-2.5 right-2.5 top-0 h-1.5 cursor-n-resize" },
    { direction: "South", className: "bottom-0 left-2.5 right-2.5 h-1.5 cursor-s-resize" },
    { direction: "West", className: "bottom-2.5 left-0 top-2.5 w-1.5 cursor-w-resize" },
    { direction: "East", className: "bottom-2.5 right-0 top-2.5 w-1.5 cursor-e-resize" },
    { direction: "NorthWest", className: "left-0 top-0 h-2.5 w-2.5 cursor-nw-resize" },
    { direction: "NorthEast", className: "right-0 top-0 h-2.5 w-2.5 cursor-ne-resize" },
    { direction: "SouthWest", className: "bottom-0 left-0 h-2.5 w-2.5 cursor-sw-resize" },
    { direction: "SouthEast", className: "bottom-0 right-0 h-2.5 w-2.5 cursor-se-resize" },
];

interface MainLayoutProps {
    children: React.ReactNode;
    activePage: AppPage;
}

export function MainLayout({ children, activePage }: MainLayoutProps) {
    const [navigationExpanded, setNavigationExpanded] = useState(
        () => localStorage.getItem("navigationExpanded") === "true",
    );

    const toggleNavigation = () => {
        setNavigationExpanded((expanded) => {
            localStorage.setItem("navigationExpanded", String(!expanded));
            return !expanded;
        });
    };

    return (
        <div className="app-canvas h-screen w-full overflow-hidden bg-transparent p-1.5 font-sans text-foreground">
            {appWindow && resizeHandles.map(({ direction, className }) => (
                <div
                    key={direction}
                    aria-hidden="true"
                    className={`window-resize-handle fixed z-[100] ${className}`}
                    onMouseDown={(event) => {
                        if (event.button !== 0) return;
                        event.preventDefault();
                        void appWindow.startResizeDragging(direction);
                    }}
                />
            ))}
            <div className="app-frame flex h-full w-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg shadow-black/20">
                <TitleBar />
                <div className="relative flex min-h-0 flex-1 overflow-hidden border-t border-border">
                    <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background">
                        {children}
                    </main>
                    <Sidebar activePage={activePage} expanded={navigationExpanded} />
                    <button
                        type="button"
                        onClick={toggleNavigation}
                        aria-label={navigationExpanded ? "Collapse navigation" : "Expand navigation"}
                        aria-expanded={navigationExpanded}
                        className={`absolute bottom-3 z-40 flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm transition-[right,color,background-color] hover:bg-accent hover:text-foreground ${navigationExpanded ? "right-[12.75rem]" : "right-3"}`}
                    >
                        {navigationExpanded ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                    </button>
                </div>
            </div>
        </div>
    );
}
