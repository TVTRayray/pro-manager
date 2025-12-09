import { useState, useEffect } from "react";
import { X, FolderOpen, Terminal } from "lucide-react";
import type { ProjectInput, OpenConfig } from "../types";
import { open } from '@tauri-apps/plugin-dialog';
import { cn } from "../lib/utils";
import { useApp } from "../context/AppContext";
import { CustomSelect } from "./CustomSelect";

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

    useEffect(() => {
        if (initialData) {
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

    const resetForm = () => {
        setName("");
        setPath("");
        setDescription("");
        setConfigMode("system_default");
        setExecutable("");
        setArgs("");
        setCommand("");
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
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

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
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-lg bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-4 border-b border-border">
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Terminal className="w-5 h-5 text-primary" />
                        {initialData ? "Edit Project" : "New Project"}
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-4 space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Project Name</label>
                        <input
                            required
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                            placeholder="My Awesome Project"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Path</label>
                        <div className="flex gap-2">
                            <input
                                required
                                type="text"
                                value={path}
                                onChange={(e) => setPath(e.target.value)}
                                className="flex-1 bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                                placeholder="/path/to/project"
                            />
                            <button
                                type="button"
                                onClick={handleBrowse}
                                className="px-3 py-2 bg-accent hover:bg-accent/80 border border-input rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                            >
                                <FolderOpen className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-border">
                        <label className="text-xs font-medium text-muted-foreground block">Launch Configuration</label>
                        <div className="grid grid-cols-3 gap-2">
                            {(['system_default', 'custom_app', 'custom_command'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => setConfigMode(mode)}
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
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                {launchPresets.length > 0 && (
                                    <div className="relative flex gap-2 w-full">
                                        <div className="flex-1">
                                            <CustomSelect
                                                options={launchPresets.map(p => ({ label: p.name, value: p.id }))}
                                                value=""
                                                onChange={(val) => {
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
                                                placeholder="Load Preset..."
                                            />
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
                                    className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                                    placeholder="Executable (e.g., code, idea64.exe)"
                                />
                                <input
                                    type="text"
                                    value={args}
                                    onChange={(e) => setArgs(e.target.value)}
                                    className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                                    placeholder="Arguments (space separated)"
                                />
                            </div>
                        )}

                        {configMode === 'custom_command' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                <input
                                    required
                                    type="text"
                                    value={command}
                                    onChange={(e) => setCommand(e.target.value)}
                                    className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                                    placeholder="Command (e.g., npm run dev)"
                                />
                            </div>
                        )}
                    </div>

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
