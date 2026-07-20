import { useRef, useState, useEffect } from "react";
import { X, FolderOpen, Terminal } from "lucide-react";
import type { ProjectInput, OpenConfig } from "../types";
import { open } from '@tauri-apps/plugin-dialog';
import { cn } from "../lib/utils";
import { useApp } from "../context/AppContext";

interface ProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: ProjectInput) => Promise<void>;
    initialData?: ProjectInput;
}

export function ProjectModal({ isOpen, onClose, onSubmit, initialData }: ProjectModalProps) {
    const { launchPresets, setActivePage, setActiveSettingsTab } = useApp();
    const [name, setName] = useState("");
    const [path, setPath] = useState("");
    const [description, setDescription] = useState("");
    const [configMode, setConfigMode] = useState<OpenConfig['mode']>("system_default");
    const [executable, setExecutable] = useState("");
    const [args, setArgs] = useState("");
    const [command, setCommand] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const dialogRef = useRef<HTMLDivElement>(null);
    const firstControlRef = useRef<HTMLInputElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (initialData) {
            setError("");
            setName(initialData.name);
            setPath(initialData.path);
            setDescription(initialData.description || "");
            setConfigMode(initialData.openConfig.mode);
            if (initialData.openConfig.mode === 'custom_app') {
                setExecutable(initialData.openConfig.executable);
                setArgs(initialData.openConfig.args.join(" "));
            } else if (initialData.openConfig.mode === 'custom_command') {
                setCommand(initialData.openConfig.command);
                setArgs(initialData.openConfig.args.join(" "));
            }
        } else {
            resetForm();
        }
    }, [initialData, isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const frame = requestAnimationFrame(() => firstControlRef.current?.focus());
        return () => {
            cancelAnimationFrame(frame);
            previousFocusRef.current?.focus();
        };
    }, [isOpen]);

    const resetForm = () => {
        setName("");
        setPath("");
        setDescription("");
        setConfigMode("system_default");
        setExecutable("");
        setArgs("");
        setCommand("");
        setError("");
    };

    const handleBrowse = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
            });
            if (selected) {
                setPath(selected as string);
                // Auto-fill name if empty
                if (!name) {
                    const parts = (selected as string).split(/[\\/]/);
                    setName(parts[parts.length - 1]);
                }
            }
        } catch (err) {
            console.error("Failed to open dialog", err);
            setError(`Could not open folder picker: ${String(err)}`);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");

        try {
            let openConfig: OpenConfig;
            if (configMode === 'system_default') {
                openConfig = { mode: 'system_default' };
            } else if (configMode === 'custom_app') {
                openConfig = {
                    mode: 'custom_app',
                    executable,
                    args: args.split(" ").filter(Boolean)
                };
            } else {
                openConfig = {
                    mode: 'custom_command',
                    command,
                    args: args.split(" ").filter(Boolean)
                };
            }

            await onSubmit({
                id: initialData?.id,
                name,
                path,
                description,
                openConfig
            });
            onClose();
        } catch (error) {
            console.error("Failed to submit project:", error);
            setError(`Could not save project: ${String(error)}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape" && !isSubmitting) {
            event.preventDefault();
            onClose();
            return;
        }
        if (event.key !== "Tab" || !dialogRef.current) return;

        const controls = [...dialogRef.current.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])")];
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/25 p-3">
            <div ref={dialogRef} onKeyDown={handleDialogKeyDown} role="dialog" aria-modal="true" aria-labelledby="project-dialog-title" className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 id="project-dialog-title" className="flex items-center gap-2 text-base font-semibold text-foreground">
                        <Terminal className="w-5 h-5 text-primary" />
                        {initialData ? "Edit Project" : "New Project"}
                    </h2>
                    <button onClick={onClose} disabled={isSubmitting} aria-label="Close project dialog" className="icon-button">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-4">
                    {error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
                    <div className="space-y-1">
                        <label htmlFor="project-name" className="text-xs font-medium text-muted-foreground">Project Name</label>
                        <input
                            id="project-name"
                            ref={firstControlRef}
                            required
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                            placeholder="My Awesome Project"
                        />
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="project-path" className="text-xs font-medium text-muted-foreground">Path</label>
                        <div className="flex gap-2">
                            <input
                                id="project-path"
                                required
                                type="text"
                                value={path}
                                onChange={(e) => setPath(e.target.value)}
                                className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                                placeholder="/path/to/project"
                            />
                            <button
                                type="button"
                                onClick={handleBrowse}
                                aria-label="Browse for project folder"
                                className="px-3 py-2 bg-accent hover:bg-accent/80 border border-input rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <FolderOpen className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="project-description" className="text-xs font-medium text-muted-foreground">Description (Optional)</label>
                        <textarea id="project-description" value={description} onChange={(event) => setDescription(event.target.value)} rows={2} className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground" placeholder="A short note about this project" />
                    </div>

                    <div className="space-y-3 pt-2 border-t border-border">
                        <label className="text-xs font-medium text-muted-foreground block">Launch Configuration</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['system_default', 'custom_app', 'custom_command'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => setConfigMode(mode)}
                                    aria-pressed={configMode === mode}
                                    className={cn(
                                        "px-2 py-1.5 text-xs font-medium rounded-md border transition-all",
                                        configMode === mode
                                            ? "bg-primary/10 border-primary text-primary"
                                            : "bg-accent/50 border-transparent text-muted-foreground hover:bg-accent hover:text-foreground"
                                    )}
                                >
                                    {mode.replace('_', ' ').toUpperCase()}
                                </button>
                            ))}
                        </div>

                        {configMode === 'custom_app' && (
                            <div className="space-y-2">
                                {launchPresets.length > 0 && (
                                    <div className="relative flex gap-2 w-full">
                                        <div className="flex-1">
                                            <select
                                                aria-label="Load launch preset"
                                                value=""
                                                onChange={(event) => {
                                                    const val = event.target.value;
                                                    const preset = launchPresets.find(p => p.id === val);
                                                    if (preset) {
                                                        setConfigMode(preset.config.mode);
                                                        if (preset.config.mode === 'custom_app') {
                                                            setExecutable(preset.config.executable);
                                                            setArgs(preset.config.args.join(" "));
                                                        } else if (preset.config.mode === 'custom_command') {
                                                            setCommand(preset.config.command);
                                                            setArgs(preset.config.args.join(" "));
                                                        }
                                                    }
                                                }}
                                                className="h-[34px] w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
                                            >
                                                <option value="">Load preset...</option>
                                                {launchPresets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                                            </select>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setActivePage("settings");
                                                setActiveSettingsTab("launch");
                                                onClose();
                                            }}
                                            className="px-3 py-2 text-xs font-medium rounded-lg border bg-background border-input text-muted-foreground hover:text-foreground hover:border-primary transition-all whitespace-nowrap h-[34px]"
                                        >
                                            Configure Preset
                                        </button>
                                    </div>
                                )}
                                <input
                                    required
                                    type="text"
                                    value={executable}
                                    onChange={(e) => setExecutable(e.target.value)}
                                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                                    placeholder="Executable (e.g., code, idea64.exe)"
                                />
                                <input
                                    type="text"
                                    value={args}
                                    onChange={(e) => setArgs(e.target.value)}
                                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                                    placeholder="Arguments (space separated)"
                                />
                            </div>
                        )}

                        {configMode === 'custom_command' && (
                            <div className="space-y-2">
                                <input
                                    required
                                    type="text"
                                    value={command}
                                    onChange={(e) => setCommand(e.target.value)}
                                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
                                    placeholder="Command (e.g., npm run dev)"
                                />
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold rounded-lg transition-colors shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? "Saving..." : "Save Project"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
