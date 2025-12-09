import { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import { fetchSettings } from "../api";
import type { ThemePreference } from "../types";

interface AppContextType {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    theme: ThemePreference;
    setTheme: (theme: ThemePreference) => void;
    accentColor: string;
    setAccentColor: (color: string) => void;
    zoomLevel: number;
    setZoomLevel: (zoom: number) => void;
    launchPresets: import("../types").LaunchPreset[];
    activePage: string;
    setActivePage: (page: string) => void;
    activeSettingsTab: "appearance" | "launch";
    setActiveSettingsTab: (tab: "appearance" | "launch") => void;
    reloadSettings: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Helper to convert Hex to HSL
function hexToHsl(hex: string): string {
    // Remove # if present
    hex = hex.replace(/^#/, '');

    // Parse r, g, b
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    // Return as space-separated values for Tailwind: "H S% L%"
    return `${(h * 360).toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}

export function AppProvider({ children }: { children: ReactNode }) {
    const [searchQuery, setSearchQuery] = useState("");
    const [theme, setTheme] = useState<ThemePreference>("system");
    const [accentColor, setAccentColor] = useState("#3b82f6"); // Default blue
    const [zoomLevel, setZoomLevel] = useState(100);
    const [launchPresets, setLaunchPresets] = useState<import("../types").LaunchPreset[]>([]);
    const [activePage, setActivePage] = useState("projects");
    const [activeSettingsTab, setActiveSettingsTab] = useState<"appearance" | "launch">("appearance");

    useEffect(() => {
        loadSettings();
        // Load client-side settings
        const savedAccent = localStorage.getItem("accentColor");
        if (savedAccent) setAccentColor(savedAccent);

        const savedZoom = localStorage.getItem("zoomLevel");
        if (savedZoom) setZoomLevel(parseInt(savedZoom));
    }, []);

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove("light", "dark");

        if (theme === "system") {
            const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light";
            root.classList.add(systemTheme);
        } else {
            root.classList.add(theme);
        }
    }, [theme]);

    useEffect(() => {
        // Convert hex to HSL and set --primary variable
        const hsl = hexToHsl(accentColor);
        document.documentElement.style.setProperty("--primary", hsl);

        // Also update ring color to match
        document.documentElement.style.setProperty("--ring", hsl);

        localStorage.setItem("accentColor", accentColor);
    }, [accentColor]);

    useEffect(() => {
        (document.body.style as any).zoom = `${zoomLevel}%`;
        localStorage.setItem("zoomLevel", zoomLevel.toString());
    }, [zoomLevel]);

    const loadSettings = async () => {
        try {
            const settings = await fetchSettings();
            setTheme(settings.theme);
            setAccentColor(settings.accentColor);
            setZoomLevel(settings.zoomLevel);
            setLaunchPresets(settings.launchPresets);
        } catch (error) {
            console.error("Failed to load settings:", error);
        }
    };

    return (
        <AppContext.Provider value={{
            searchQuery, setSearchQuery,
            theme, setTheme,
            accentColor, setAccentColor,
            zoomLevel, setZoomLevel,
            launchPresets,
            activePage, setActivePage,
            activeSettingsTab, setActiveSettingsTab,
            reloadSettings: loadSettings
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useApp() {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error("useApp must be used within an AppProvider");
    }
    return context;
}
