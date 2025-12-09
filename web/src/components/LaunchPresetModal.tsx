import { useState, useEffect } from "react";
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

    useEffect(() => {
        if (isOpen) {
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

    const resetForm = () => {
        setName("");
        setDescription("");
        setMode("system_default");
        setExecutable("");
        setCommand("");
        setArgs("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

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
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Terminal className="w-5 h-5 text-primary" />
                        {initialData ? "Edit Preset" : "New Launch Preset"}
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Preset Name</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-background border border-input rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary transition-colors"
                            placeholder="e.g., VS Code, Terminal"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Description (Optional)</label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-background border border-input rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary transition-colors"
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
                        <div className="space-y-2 animate-in slide-in-from-top-2">
                            <label className="text-sm font-medium text-foreground">Executable Path</label>
                            <input
                                type="text"
                                required
                                value={executable}
                                onChange={(e) => setExecutable(e.target.value)}
                                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary transition-colors"
                                placeholder="C:\Path\To\App.exe"
                            />
                        </div>
                    )}

                    {mode === "custom_command" && (
                        <div className="space-y-2 animate-in slide-in-from-top-2">
                            <label className="text-sm font-medium text-foreground">Command</label>
                            <input
                                type="text"
                                required
                                value={command}
                                onChange={(e) => setCommand(e.target.value)}
                                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary transition-colors"
                                placeholder="npm, cargo, python"
                            />
                        </div>
                    )}

                    {mode !== "system_default" && (
                        <div className="space-y-2 animate-in slide-in-from-top-2">
                            <label className="text-sm font-medium text-foreground">Arguments</label>
                            <input
                                type="text"
                                value={args}
                                onChange={(e) => setArgs(e.target.value)}
                                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-primary transition-colors"
                                placeholder="--flag value"
                            />
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-4 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
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
