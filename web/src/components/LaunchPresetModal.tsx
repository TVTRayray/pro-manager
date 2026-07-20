import { useRef, useState, useEffect } from "react";
import { X, Save, Terminal } from "lucide-react";
import type { LaunchPreset, LaunchPresetInput, OpenConfig } from "../types";
import { cn } from "../lib/utils";

interface LaunchPresetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: LaunchPresetInput) => Promise<void>;
    initialData?: LaunchPreset;
}

export function LaunchPresetModal({ isOpen, onClose, onSubmit, initialData }: LaunchPresetModalProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [mode, setMode] = useState<"system_default" | "custom_app" | "custom_command">("system_default");
    const [executable, setExecutable] = useState("");
    const [command, setCommand] = useState("");
    const [args, setArgs] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState("");
    const dialogRef = useRef<HTMLDivElement>(null);
    const firstControlRef = useRef<HTMLInputElement>(null);
    const previousFocusRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (isOpen) {
            setError("");
            if (initialData) {
                setName(initialData.name);
                setDescription(initialData.description || "");

                const config = initialData.config;
                if ('executable' in config) {
                    setMode("custom_app");
                    setExecutable(config.executable as string);
                    setArgs((config.args || []).join(" "));
                } else if ('command' in config) {
                    setMode("custom_command");
                    setCommand(config.command);
                    setArgs((config.args || []).join(" "));
                } else {
                    setMode("system_default");
                }
            } else {
                resetForm();
            }
        }
    }, [isOpen, initialData]);

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
        setDescription("");
        setMode("system_default");
        setExecutable("");
        setCommand("");
        setArgs("");
        setError("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError("");

        try {
            let config: OpenConfig;
            const argsList = args.split(" ").filter(a => a.length > 0);

            switch (mode) {
                case "custom_app":
                    config = { mode: "custom_app", executable, args: argsList };
                    break;
                case "custom_command":
                    config = { mode: "custom_command", command, args: argsList };
                    break;
                default:
                    config = { mode: "system_default" };
            }

            await onSubmit({
                id: initialData?.id,
                name,
                description: description || undefined,
                config
            });
            onClose();
        } catch (error) {
            console.error("Failed to submit preset:", error);
            setError(`Could not save preset: ${String(error)}`);
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
            <div ref={dialogRef} onKeyDown={handleDialogKeyDown} role="dialog" aria-modal="true" aria-labelledby="preset-dialog-title" className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 id="preset-dialog-title" className="flex items-center gap-2 text-base font-semibold text-foreground">
                        <Terminal className="w-5 h-5 text-primary" />
                        {initialData ? "Edit Preset" : "New Launch Preset"}
                    </h2>
                    <button onClick={onClose} disabled={isSubmitting} aria-label="Close launch preset dialog" className="icon-button">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto p-4">
                    {error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
                    <div className="space-y-2">
                        <label htmlFor="preset-name" className="text-sm font-medium text-foreground">Preset Name</label>
                        <input
                            id="preset-name"
                            ref={firstControlRef}
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
                            placeholder="e.g., VS Code, Terminal"
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="preset-description" className="text-sm font-medium text-foreground">Description (Optional)</label>
                        <input
                            id="preset-description"
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
                            placeholder="Brief description of this preset"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Launch Mode</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['system_default', 'custom_app', 'custom_command'] as const).map((m) => (
                                <button
                                    key={m}
                                    type="button"
                                    onClick={() => setMode(m)}
                                    aria-pressed={mode === m}
                                    className={cn(
                                        "px-2 py-2 text-xs font-medium rounded-lg border transition-all",
                                        mode === m
                                            ? "bg-primary/10 border-primary text-primary"
                                            : "bg-background border-border text-muted-foreground hover:border-input"
                                    )}
                                >
                                    {m.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </button>
                            ))}
                        </div>
                    </div>

                    {mode === "custom_app" && (
                        <div className="space-y-2">
                            <label htmlFor="preset-executable" className="text-sm font-medium text-foreground">Executable Path</label>
                            <input
                                id="preset-executable"
                                type="text"
                                required
                                value={executable}
                                onChange={(e) => setExecutable(e.target.value)}
                                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
                                placeholder="C:\Path\To\App.exe"
                            />
                        </div>
                    )}

                    {mode === "custom_command" && (
                        <div className="space-y-2">
                            <label htmlFor="preset-command" className="text-sm font-medium text-foreground">Command</label>
                            <input
                                id="preset-command"
                                type="text"
                                required
                                value={command}
                                onChange={(e) => setCommand(e.target.value)}
                                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
                                placeholder="npm, cargo, python"
                            />
                        </div>
                    )}

                    {mode !== "system_default" && (
                        <div className="space-y-2">
                            <label htmlFor="preset-arguments" className="text-sm font-medium text-foreground">Arguments</label>
                            <input
                                id="preset-arguments"
                                type="text"
                                value={args}
                                onChange={(e) => setArgs(e.target.value)}
                                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-foreground"
                                placeholder="--flag value"
                            />
                        </div>
                    )}

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
                            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold rounded-lg transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            Save Preset
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
