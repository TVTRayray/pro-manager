import { useState, useEffect } from "react";
import { ChevronDown, Plus, Check } from "lucide-react";
import { fetchWorkspaces, fetchActiveWorkspace, createWorkspace, setActiveWorkspace } from "../api";
import type { Workspace } from "../types";
import { cn } from "../lib/utils";

export function WorkspaceSelector() {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newWorkspaceName, setNewWorkspaceName] = useState("");

    useEffect(() => {
        loadWorkspaces();
    }, []);

    const loadWorkspaces = async () => {
        try {
            const [list, active] = await Promise.all([
                fetchWorkspaces(),
                fetchActiveWorkspace()
            ]);
            setWorkspaces(list);
            setActiveWorkspaceState(active);
        } catch (error) {
            console.error("Failed to load workspaces:", error);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newWorkspaceName.trim()) return;

        try {
            const newWs = await createWorkspace({ name: newWorkspaceName, description: "" });
            setWorkspaces([...workspaces, newWs]);
            await handleSelect(newWs);
            setNewWorkspaceName("");
            setIsCreating(false);
        } catch (error) {
            console.error("Failed to create workspace:", error);
        }
    };

    const handleSelect = async (workspace: Workspace) => {
        try {
            await setActiveWorkspace(workspace.id);
            setActiveWorkspaceState(workspace);
            setIsOpen(false);
            // Reload page or trigger global refresh if needed
            window.location.reload();
        } catch (error) {
            console.error("Failed to set active workspace:", error);
        }
    };

    return (
        <div className="relative px-2 mb-6">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-accent/50 transition-colors border border-transparent hover:border-border group"
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded bg-primary flex items-center justify-center shrink-0 shadow-lg shadow-primary/20 transition-all">
                        <span className="text-sm font-bold text-primary-foreground">
                            {activeWorkspace?.name.substring(0, 2).toUpperCase() || "WS"}
                        </span>
                    </div>
                    <div className="flex flex-col items-start overflow-hidden">
                        <span className="text-sm font-medium text-foreground truncate w-full text-left">
                            {activeWorkspace?.name || "Select Workspace"}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">Workspace</span>
                    </div>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-2 right-2 mt-2 bg-popover border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-2 space-y-1 max-h-60 overflow-y-auto">
                        {workspaces.map((ws) => (
                            <button
                                key={ws.id}
                                onClick={() => handleSelect(ws)}
                                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-accent transition-colors group"
                            >
                                <span className={cn("text-sm", activeWorkspace?.id === ws.id ? "text-primary font-medium" : "text-foreground")}>
                                    {ws.name}
                                </span>
                                {activeWorkspace?.id === ws.id && <Check className="w-3 h-3 text-primary" />}
                            </button>
                        ))}
                    </div>

                    <div className="p-2 border-t border-border bg-accent/20">
                        {isCreating ? (
                            <form onSubmit={handleCreate} className="flex flex-col gap-2">
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Workspace Name"
                                    value={newWorkspaceName}
                                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                                    className="w-full bg-background border border-input rounded px-2 py-1.5 text-sm text-foreground focus:outline-none focus:border-primary"
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="submit"
                                        className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium py-1.5 rounded transition-colors"
                                    >
                                        Create
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setIsCreating(false)}
                                        className="px-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium py-1.5 rounded transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <button
                                onClick={() => setIsCreating(true)}
                                className="w-full flex items-center justify-center gap-2 p-2 rounded-lg hover:bg-accent text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border border-dashed border-border hover:border-primary/50"
                            >
                                <Plus className="w-3 h-3" />
                                New Workspace
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
