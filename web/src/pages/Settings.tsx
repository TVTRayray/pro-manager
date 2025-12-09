import { useState, useEffect } from "react";
import { Monitor, Terminal, RefreshCw, Plus, Trash2, Edit2, Check, Sun, Moon } from "lucide-react";
import { fetchSettings, updateSettings } from "../api";
import type { AppSettings, AppSettingsPayload, LaunchPreset, LaunchPresetInput } from "../types";
import { cn } from "../lib/utils";
import { useApp } from "../context/AppContext";
import { LaunchPresetModal } from "../components/LaunchPresetModal";

const ACCENT_COLORS = [
    "#3b82f6", // Blue
    "#ef4444", // Red
    "#f97316", // Orange
    "#f59e0b", // Amber
    "#10b981", // Emerald
    "#06b6d4", // Cyan
    "#8b5cf6", // Violet
    "#d946ef", // Fuchsia
];

const ZOOM_LEVELS = [80, 90, 100, 110, 120];

export function Settings() {
    const { setTheme: setContextTheme, setAccentColor: setContextAccentColor, setZoomLevel: setContextZoomLevel, activeSettingsTab, setActiveSettingsTab, reloadSettings } = useApp();
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPreset, setEditingPreset] = useState<LaunchPreset | undefined>(undefined);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const data = await fetchSettings();
            setSettings(data);
        } catch (error) {
            console.error("Failed to load settings:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const updateAndSave = async (updates: Partial<AppSettingsPayload>) => {
        if (!settings) return;

        // Optimistic update for local UI
        const newSettings = { ...settings, ...updates } as AppSettings;
        setSettings(newSettings);

        // Update Context immediately for responsiveness
        if (updates.theme) setContextTheme(updates.theme);
        if (updates.accentColor) setContextAccentColor(updates.accentColor);
        if (updates.zoomLevel) setContextZoomLevel(updates.zoomLevel);

        try {
            const payload: AppSettingsPayload = {
                theme: updates.theme ?? settings.theme,
                accentColor: updates.accentColor ?? settings.accentColor,
                zoomLevel: updates.zoomLevel ?? settings.zoomLevel,
                fontFamily: updates.fontFamily ?? settings.fontFamily,
                fontSize: updates.fontSize ?? settings.fontSize,
                launchPresets: (updates.launchPresets ?? settings.launchPresets).map(p => ({
                    id: p.id,
                    name: p.name,
                    description: p.description,
                    config: p.config
                }))
            };
            const updated = await updateSettings(payload);
            setSettings(updated);
            // Reload context to ensure everything is in sync (esp. presets)
            await reloadSettings();
        } catch (error) {
            console.error("Failed to save settings:", error);
            // Revert on error (re-fetch)
            loadSettings();
        }
    };

    const handlePresetSubmit = async (data: LaunchPresetInput) => {
        if (!settings) return;

        let newPresets = [...settings.launchPresets];
        if (data.id) {
            // Edit existing
            newPresets = newPresets.map(p => p.id === data.id ? { ...p, ...data, id: p.id } as LaunchPreset : p);
        } else {
            // Add new
            const newPreset: LaunchPreset = {
                id: crypto.randomUUID(),
                name: data.name,
                description: data.description,
                config: data.config
            };
            newPresets.push(newPreset);
        }

        await updateAndSave({ launchPresets: newPresets });
    };

    const handleDeletePreset = async (presetId: string) => {
        if (!settings) return;
        const newPresets = settings.launchPresets.filter(p => p.id !== presetId);
        await updateAndSave({ launchPresets: newPresets });
    };

    if (isLoading) {
        return <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading settings...</div>;
    }

    if (!settings) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-muted-foreground">
                <p>Failed to load settings</p>
                <button onClick={loadSettings} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">
                    <RefreshCw className="w-4 h-4" /> Retry
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-background text-foreground transition-colors duration-300">
            <div className="max-w-4xl mx-auto p-8 space-y-8">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
                        <p className="text-muted-foreground text-sm mt-1">Manage your application preferences</p>
                    </div>
                    {/* Save button removed as per auto-save request */}
                </div>

                <div className="flex gap-8">
                    {/* Sidebar Navigation */}
                    <div className="w-64 shrink-0 space-y-1">
                        <button
                            onClick={() => setActiveSettingsTab("appearance")}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                                activeSettingsTab === "appearance"
                                    ? "bg-primary/10 text-primary border border-primary/20"
                                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                        >
                            <Monitor className="w-4 h-4" />
                            Appearance
                        </button>
                        <button
                            onClick={() => setActiveSettingsTab("launch")}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                                activeSettingsTab === "launch"
                                    ? "bg-primary/10 text-primary border border-primary/20"
                                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                            )}
                        >
                            <Terminal className="w-4 h-4" />
                            Launch Presets
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 space-y-8">
                        {activeSettingsTab === "appearance" && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                                {/* Theme Section */}
                                <section className="space-y-4">
                                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                                        <Monitor className="w-5 h-5 text-muted-foreground" />
                                        Theme
                                    </h2>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => updateAndSave({ theme: 'light' })}
                                            className={cn(
                                                "w-10 h-10 rounded-full transition-all flex items-center justify-center border",
                                                settings.theme === 'light'
                                                    ? "bg-white text-black border-gray-200 ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
                                                    : "bg-white/50 text-black/70 border-gray-200 hover:scale-105 hover:bg-white hover:text-black"
                                            )}
                                            title="Light Theme"
                                        >
                                            {settings.theme === 'light' ? <Check className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                                        </button>
                                        <button
                                            onClick={() => updateAndSave({ theme: 'dark' })}
                                            className={cn(
                                                "w-10 h-10 rounded-full transition-all flex items-center justify-center border",
                                                settings.theme === 'dark'
                                                    ? "bg-slate-950 text-white border-slate-800 ring-2 ring-offset-2 ring-offset-background ring-primary scale-110"
                                                    : "bg-slate-900/50 text-white/70 border-slate-800 hover:scale-105 hover:bg-slate-900 hover:text-white"
                                            )}
                                            title="Dark Theme"
                                        >
                                            {settings.theme === 'dark' ? <Check className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </section>

                                {/* Accent Color Section */}
                                <section className="space-y-4 pt-6 border-t border-border">
                                    <h2 className="text-lg font-bold text-foreground">Accent Color</h2>
                                    <div className="flex flex-wrap gap-3">
                                        {ACCENT_COLORS.map((color) => (
                                            <button
                                                key={color}
                                                onClick={() => updateAndSave({ accentColor: color })}
                                                className={cn(
                                                    "w-10 h-10 rounded-full transition-all flex items-center justify-center",
                                                    settings.accentColor === color
                                                        ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110"
                                                        : "hover:scale-105 opacity-80 hover:opacity-100"
                                                )}
                                                style={{ backgroundColor: color }}
                                            >
                                                {settings.accentColor === color && <Check className="w-5 h-5 text-white drop-shadow-md" />}
                                            </button>
                                        ))}
                                    </div>
                                </section>

                                {/* Zoom Section */}
                                <section className="space-y-4 pt-6 border-t border-border">
                                    <h2 className="text-lg font-bold text-foreground">Display Zoom</h2>
                                    <div className="relative w-48">
                                        <select
                                            value={settings.zoomLevel}
                                            onChange={(e) => updateAndSave({ zoomLevel: parseInt(e.target.value) })}
                                            className="w-full appearance-none bg-card border border-input rounded-lg px-4 py-2.5 text-foreground focus:outline-none focus:border-primary transition-colors cursor-pointer"
                                        >
                                            {ZOOM_LEVELS.map((zoom) => (
                                                <option key={zoom} value={zoom}>{zoom}%</option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                        </div>
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeSettingsTab === "launch" && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="flex items-center justify-between">
                                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-yellow-600 dark:text-yellow-200 text-sm flex-1 mr-4">
                                        <p className="flex items-center gap-2">
                                            <Terminal className="w-4 h-4" />
                                            Launch presets allow you to define reusable configurations for starting projects.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setEditingPreset(undefined);
                                            setIsModalOpen(true);
                                        }}
                                        className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-colors text-sm font-medium"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Add Preset
                                    </button>
                                </div>

                                {settings.launchPresets.length === 0 ? (
                                    <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                                        <p className="text-muted-foreground">No presets configured yet.</p>
                                        <button
                                            onClick={() => {
                                                setEditingPreset(undefined);
                                                setIsModalOpen(true);
                                            }}
                                            className="mt-4 text-primary hover:text-primary/80 text-sm font-medium"
                                        >
                                            + Add New Preset
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {settings.launchPresets.map((preset) => (
                                            <div key={preset.id} className="flex items-center justify-between p-4 bg-card border border-border rounded-xl group hover:border-border/80 transition-colors">
                                                <div>
                                                    <h3 className="font-medium text-foreground">{preset.name}</h3>
                                                    {preset.description && <p className="text-sm text-muted-foreground">{preset.description}</p>}
                                                </div>
                                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => {
                                                            setEditingPreset(preset);
                                                            setIsModalOpen(true);
                                                        }}
                                                        className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeletePreset(preset.id)}
                                                        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <LaunchPresetModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handlePresetSubmit}
                initialData={editingPreset}
            />
        </div>
    );
}
