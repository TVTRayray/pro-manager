import { useState, useEffect } from "react";
import { Window } from "@tauri-apps/api/window";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { Minus, Square, X, Copy } from "lucide-react";
import { useApp } from "../context/AppContext";

export function TitleBar() {
    const appWindow = Window.getCurrent();
    const [isMaximized, setIsMaximized] = useState(false);
    const { theme } = useApp();

    useEffect(() => {
        let unlisten: UnlistenFn | null = null;
        const syncState = async () => setIsMaximized(await appWindow.isMaximized());
        syncState();

        (async () => {
            unlisten = await appWindow.listen("tauri://resize", syncState);
        })();

        return () => {
            if (unlisten) {
                unlisten();
            }
        };
    }, []);

    const minimize = async () => {
        await appWindow.minimize();
    };

    const toggleMaximize = async () => {
        if (await appWindow.isMaximized()) {
            appWindow.unmaximize();
            setIsMaximized(false);
        } else {
            appWindow.maximize();
            setIsMaximized(true);
        }
    };

    const close = async () => {
        await appWindow.close();
    };

    const isDark = theme === "dark";
    const backgroundClass = isDark ? "bg-[#1e1e1e] border-[#333]" : "bg-[#f3f4f6] border-[#d1d5db]";
    const textClass = isDark ? "text-gray-300" : "text-gray-800";
    const controlHover = isDark ? "hover:bg-[#333] text-gray-400 hover:text-white" : "hover:bg-[#e5e7eb] text-gray-500 hover:text-gray-900";

    return (
        <div
            data-tauri-drag-region
            className={`h-10 flex items-center justify-between px-3 select-none border-b ${backgroundClass}`}
            onDoubleClick={toggleMaximize}
        >
            {/* Left: Logo */}
            <div className="flex items-center gap-3 h-full px-4">
                {/* <div className="flex items-center justify-center">
                    <img src="/lion-svgrepo-com.svg" alt="Logo" className="w-5 h-5 object-contain" />
                </div> */}
            </div>

            {/* Center: Title */}
            <div className={`absolute left-1/2 -translate-x-1/2 text-sm font-bold pointer-events-none select-none ${textClass}`}>
                Pro Manager
            </div>

            {/* Right: Window Controls */}
            <div className="flex items-center h-full">
                <button
                    type="button"
                    data-tauri-drag-region="false"
                    onClick={minimize}
                    className={`h-full w-10 flex items-center justify-center transition-colors ${controlHover}`}
                >
                    <Minus className="w-4 h-4" />
                </button>
                <button
                    type="button"
                    data-tauri-drag-region="false"
                    onClick={toggleMaximize}
                    className={`h-full w-10 flex items-center justify-center transition-colors ${controlHover}`}
                >
                    {isMaximized ? <Copy className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                </button>
                <button
                    type="button"
                    data-tauri-drag-region="false"
                    onClick={close}
                    className={`h-full w-10 flex items-center justify-center text-gray-400 transition-colors ${isDark ? "hover:bg-red-500 hover:text-white" : "hover:bg-red-200 hover:text-red-700"}`}
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
