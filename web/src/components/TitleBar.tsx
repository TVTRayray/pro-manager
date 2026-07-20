import { useEffect, useState } from "react";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { Window } from "@tauri-apps/api/window";
import { AppWindow, Copy, Minus, Square, X } from "lucide-react";

const appWindow = (() => {
    try {
        return Window.getCurrent();
    } catch {
        return null;
    }
})();

export function TitleBar() {
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        if (!appWindow) return;
        let disposed = false;
        let unlisten: UnlistenFn | undefined;
        const syncState = async () => {
            const maximized = await appWindow.isMaximized();
            if (!disposed) {
                setIsMaximized(maximized);
                document.documentElement.dataset.maximized = String(maximized);
            }
        };

        void syncState();
        void appWindow.listen("tauri://resize", syncState).then((stop) => {
            if (disposed) stop();
            else unlisten = stop;
        });
        return () => {
            disposed = true;
            unlisten?.();
            delete document.documentElement.dataset.maximized;
        };
    }, []);

    const toggleMaximize = async () => {
        if (!appWindow) return;
        if (await appWindow.isMaximized()) await appWindow.unmaximize();
        else await appWindow.maximize();
        setIsMaximized(await appWindow.isMaximized());
    };

    return (
        <div
            data-tauri-drag-region={!!appWindow}
            className="flex h-10 shrink-0 select-none items-center justify-between bg-card pl-3"
            onDoubleClick={(event) => {
                if (!(event.target as HTMLElement).closest("button")) void toggleMaximize();
            }}
        >
            <div className="pointer-events-none flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <AppWindow className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                <span>pro-manager</span>
            </div>
            {appWindow && (
                <div className="flex h-full items-center">
                    <button type="button" data-tauri-drag-region="false" onClick={() => void appWindow.minimize()} aria-label="Minimize window" className="icon-button h-full w-10 rounded-none"><Minus className="h-4 w-4" /></button>
                    <button type="button" data-tauri-drag-region="false" onClick={() => void toggleMaximize()} aria-label={isMaximized ? "Restore window" : "Maximize window"} className="icon-button h-full w-10 rounded-none">
                        {isMaximized ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
                    </button>
                    <button type="button" data-tauri-drag-region="false" onClick={() => void appWindow.close()} aria-label="Close window" className="icon-button h-full w-10 rounded-none hover:bg-destructive hover:text-destructive-foreground"><X className="h-4 w-4" /></button>
                </div>
            )}
        </div>
    );
}
