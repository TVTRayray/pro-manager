import { useEffect, useRef, useState } from "react";
import { Check, Edit2, Monitor, Moon, Plus, RefreshCw, ScanSearch, Sun, Terminal, Trash2 } from "lucide-react";
import { detectEditorPresets, fetchSettings, updateSettings } from "../api";
import { LaunchPresetModal } from "../components/LaunchPresetModal";
import { useApp } from "../context/AppContext";
import { cn } from "../lib/utils";
import type { AppSettings, AppSettingsPayload, LaunchPreset, LaunchPresetInput } from "../types";

const ACCENT_COLORS = ["#3b82f6", "#ef4444", "#f97316", "#f59e0b", "#10b981", "#06b6d4", "#8b5cf6", "#d946ef"];
const ZOOM_LEVELS = [80, 90, 100, 110, 120];

export function Settings() {
    const {
        setTheme: setContextTheme,
        setAccentColor: setContextAccentColor,
        setZoomLevel: setContextZoomLevel,
        activeSettingsTab,
        setActiveSettingsTab,
        reloadSettings,
    } = useApp();
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPreset, setEditingPreset] = useState<LaunchPreset>();
    const [error, setError] = useState("");
    const [detectStatus, setDetectStatus] = useState("");
    const [isDetecting, setIsDetecting] = useState(false);
    const settingsRef = useRef<AppSettings | null>(null);
    const persistedSettingsRef = useRef<AppSettings | null>(null);
    const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
    const saveVersionRef = useRef(0);

    useEffect(() => {
        void loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const loaded = await fetchSettings();
            settingsRef.current = loaded;
            persistedSettingsRef.current = loaded;
            setSettings(loaded);
            setError("");
        } catch (error) {
            console.error("Failed to load settings:", error);
            setError(`Could not load settings: ${String(error)}`);
        } finally {
            setIsLoading(false);
        }
    };

    const updateAndSave = async (updates: Partial<AppSettingsPayload>) => {
        const current = settingsRef.current;
        if (!current) throw new Error("Settings are not loaded");
        const optimistic = { ...current, ...updates } as AppSettings;
        const version = ++saveVersionRef.current;
        const payload: AppSettingsPayload = {
            theme: optimistic.theme,
            accentColor: optimistic.accentColor,
            zoomLevel: optimistic.zoomLevel,
            fontFamily: optimistic.fontFamily,
            fontSize: optimistic.fontSize,
            launchPresets: optimistic.launchPresets.map(({ id, name, description, config }) => ({ id, name, description, config })),
        };

        settingsRef.current = optimistic;
        setSettings(optimistic);
        if (updates.theme) setContextTheme(updates.theme);
        if (updates.accentColor) setContextAccentColor(updates.accentColor);
        if (updates.zoomLevel) setContextZoomLevel(updates.zoomLevel);

        const queuedSave = saveQueueRef.current.then(async () => {
            try {
                const updated = await updateSettings(payload);
                persistedSettingsRef.current = updated;
                if (version !== saveVersionRef.current) return;

                settingsRef.current = updated;
                setSettings(updated);
                setError("");
                await reloadSettings(() => version === saveVersionRef.current);
            } catch (error) {
                console.error("Failed to save settings:", error);
                if (version === saveVersionRef.current && persistedSettingsRef.current) {
                    const persisted = persistedSettingsRef.current;
                    settingsRef.current = persisted;
                    setSettings(persisted);
                    setContextTheme(persisted.theme);
                    setContextAccentColor(persisted.accentColor);
                    setContextZoomLevel(persisted.zoomLevel);
                    setError(`Could not save settings: ${String(error)}`);
                    await reloadSettings(() => version === saveVersionRef.current);
                }
                throw error;
            }
        });
        saveQueueRef.current = queuedSave.catch(() => {});
        return queuedSave;
    };

    const handlePresetSubmit = async (data: LaunchPresetInput) => {
        const current = settingsRef.current;
        if (!current) throw new Error("Settings are not loaded");
        const launchPresets = data.id
            ? current.launchPresets.map((preset) => preset.id === data.id ? { ...preset, ...data, id: preset.id } as LaunchPreset : preset)
            : [...current.launchPresets, { ...data, id: crypto.randomUUID() } as LaunchPreset];
        await updateAndSave({ launchPresets });
    };

    const handleDeletePreset = (id: string) => {
        const current = settingsRef.current;
        if (!current) return Promise.resolve();
        return updateAndSave({ launchPresets: current.launchPresets.filter((preset) => preset.id !== id) });
    };

    const handleDetectPresets = async () => {
        if (!settings) return;
        setIsDetecting(true);
        setDetectStatus("");
        setError("");
        try {
            const detected = await detectEditorPresets();
            const current = settingsRef.current;
            if (!current) return;
            const seen = new Set(current.launchPresets.map((preset) => JSON.stringify(preset.config)));
            const additions = detected.flatMap((preset): LaunchPreset[] => {
                const key = JSON.stringify(preset.config);
                if (seen.has(key)) return [];
                seen.add(key);
                return [{ ...preset, id: crypto.randomUUID() }];
            });

            if (additions.length === 0) {
                setDetectStatus(detected.length === 0 ? "No supported editors were detected." : "All detected editors are already configured.");
                return;
            }
            const latest = settingsRef.current;
            if (!latest) return;
            await updateAndSave({ launchPresets: [...latest.launchPresets, ...additions] });
            setDetectStatus(`Added ${additions.length} ${additions.length === 1 ? "preset" : "presets"}.`);
        } catch (error) {
            console.error("Failed to detect editor presets:", error);
            setError(`Could not detect editors: ${String(error)}`);
        } finally {
            setIsDetecting(false);
        }
    };

    if (isLoading) return <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Loading settings...</div>;
    if (!settings) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                <p>{error || "Failed to load settings."}</p>
                <button onClick={() => void loadSettings()} className="flex h-8 items-center gap-2 rounded-md border border-input bg-card px-3 text-xs font-medium hover:bg-accent">
                    <RefreshCw className="h-3.5 w-3.5" /> Retry
                </button>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto bg-background text-foreground">
            <div className="mx-auto max-w-3xl space-y-4 p-4 sm:p-6">
                <header>
                    <h1 className="text-lg font-semibold tracking-tight">Settings</h1>
                    <p className="mt-0.5 text-xs text-muted-foreground">Preferences are saved automatically.</p>
                </header>
                {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}

                <div className="flex gap-1 rounded-lg border border-border bg-card p-1" aria-label="Settings sections">
                    <button onClick={() => setActiveSettingsTab("appearance")} aria-pressed={activeSettingsTab === "appearance"} className={cn("flex h-8 flex-1 items-center justify-center gap-2 rounded-md px-3 text-xs font-medium sm:flex-none", activeSettingsTab === "appearance" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>
                        <Monitor className="h-3.5 w-3.5" /> Appearance
                    </button>
                    <button onClick={() => setActiveSettingsTab("launch")} aria-pressed={activeSettingsTab === "launch"} className={cn("flex h-8 flex-1 items-center justify-center gap-2 rounded-md px-3 text-xs font-medium sm:flex-none", activeSettingsTab === "launch" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>
                        <Terminal className="h-3.5 w-3.5" /> Launch Presets
                    </button>
                </div>

                {activeSettingsTab === "appearance" && (
                    <section className="overflow-hidden rounded-xl border border-border bg-card" aria-labelledby="appearance-heading">
                        <div className="border-b border-border px-4 py-3">
                            <h2 id="appearance-heading" className="text-sm font-semibold">Appearance</h2>
                            <p className="mt-0.5 text-xs text-muted-foreground">Theme, accent, and interface scale.</p>
                        </div>
                        <PreferenceRow label="Theme" description="Choose a light or dark interface.">
                            <div className="flex rounded-md border border-input bg-background p-0.5">
                                <ThemeButton active={settings.theme === "light"} label="Light" icon={<Sun className="h-3.5 w-3.5" />} onClick={() => void updateAndSave({ theme: "light" }).catch(() => {})} />
                                <ThemeButton active={settings.theme === "dark"} label="Dark" icon={<Moon className="h-3.5 w-3.5" />} onClick={() => void updateAndSave({ theme: "dark" }).catch(() => {})} />
                            </div>
                        </PreferenceRow>
                        <PreferenceRow label="Accent color" description="Used for actions, focus, and status.">
                            <div className="flex flex-wrap justify-end gap-1.5">
                                {ACCENT_COLORS.map((color) => (
                                    <button key={color} onClick={() => void updateAndSave({ accentColor: color }).catch(() => {})} aria-label={`Use ${color} accent color`} aria-pressed={settings.accentColor === color} className={cn("flex h-6 w-6 items-center justify-center rounded-md border border-foreground/10", settings.accentColor === color && "ring-2 ring-ring ring-offset-1 ring-offset-card")} style={{ backgroundColor: color }}>
                                        {settings.accentColor === color && <Check className="h-3.5 w-3.5 text-white" />}
                                    </button>
                                ))}
                            </div>
                        </PreferenceRow>
                        <PreferenceRow label="Display zoom" description="Scale the entire application.">
                            <select value={settings.zoomLevel} onChange={(event) => void updateAndSave({ zoomLevel: Number(event.target.value) }).catch(() => {})} className="h-8 rounded-md border border-input bg-background px-2 text-xs">
                                {ZOOM_LEVELS.map((zoom) => <option key={zoom} value={zoom}>{zoom}%</option>)}
                            </select>
                        </PreferenceRow>
                    </section>
                )}

                {activeSettingsTab === "launch" && (
                    <section className="overflow-hidden rounded-xl border border-border bg-card" aria-labelledby="presets-heading">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                            <div>
                                <h2 id="presets-heading" className="text-sm font-semibold">Launch Presets</h2>
                                <p className="mt-0.5 text-xs text-muted-foreground">Reusable editor and command configurations.</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => void handleDetectPresets()} disabled={isDetecting} className="flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium hover:bg-accent disabled:opacity-50">
                                    <ScanSearch className="h-3.5 w-3.5" /> {isDetecting ? "Detecting..." : "Detect Editors"}
                                </button>
                                <button onClick={() => { setEditingPreset(undefined); setIsModalOpen(true); }} className="flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90">
                                    <Plus className="h-3.5 w-3.5" /> Add
                                </button>
                            </div>
                        </div>
                        {detectStatus && <p role="status" className="border-b border-border bg-muted px-4 py-2 text-xs text-muted-foreground">{detectStatus}</p>}
                        {settings.launchPresets.length === 0 ? (
                            <div className="px-4 py-10 text-center">
                                <p className="text-sm font-medium">No launch presets</p>
                                <p className="mt-1 text-xs text-muted-foreground">Detect installed editors or add one manually.</p>
                            </div>
                        ) : settings.launchPresets.map((preset) => (
                            <div key={preset.id} className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="truncate text-sm font-medium">{preset.name}</h3>
                                        <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">{preset.config.mode.replaceAll("_", " ")}</span>
                                    </div>
                                    {preset.description && <p className="mt-0.5 truncate text-xs text-muted-foreground">{preset.description}</p>}
                                </div>
                                <div className="flex shrink-0 gap-1">
                                    <button onClick={() => { setEditingPreset(preset); setIsModalOpen(true); }} aria-label={`Edit ${preset.name}`} className="icon-button"><Edit2 className="h-3.5 w-3.5" /></button>
                                    <button onClick={() => void handleDeletePreset(preset.id).catch(() => {})} aria-label={`Delete ${preset.name}`} className="icon-button hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                                </div>
                            </div>
                        ))}
                    </section>
                )}
            </div>

            <LaunchPresetModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handlePresetSubmit} initialData={editingPreset} />
        </div>
    );
}

function PreferenceRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
    return (
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
            <div><h3 className="text-sm font-medium">{label}</h3><p className="mt-0.5 text-xs text-muted-foreground">{description}</p></div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

function ThemeButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
    return <button onClick={onClick} aria-pressed={active} className={cn("flex h-7 items-center gap-1.5 rounded px-2 text-xs", active ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>{icon}{label}</button>;
}
