import { useState, useEffect } from "react";
import { ChevronDown, Plus, Check, MoreHorizontal, Edit2, Trash2, X } from "lucide-react";
import { fetchWorkspaces, fetchActiveWorkspace, createWorkspace, setActiveWorkspace, renameWorkspace, deleteWorkspace } from "../api";
import type { Workspace } from "../types";
import { cn } from "../lib/utils";
import { ask } from "@tauri-apps/plugin-dialog";
import { useApp } from "../context/AppContext";

export function WorkspaceSelector() {
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [activeWorkspace, setActiveWorkspaceState] = useState<Workspace | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [newWorkspaceName, setNewWorkspaceName] = useState("");

    const { reloadSettings, notifyWorkspaceChange } = useApp();

    // Rename state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState("");

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
            await reloadSettings();
            notifyWorkspaceChange();
        } catch (error) {
            console.error("Failed to set active workspace:", error);
        }
    };

    const startEditing = (ws: Workspace, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingId(ws.id);
        setEditName(ws.name);
    };

    const submitRename = async (e: React.FormEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (!editingId || !editName.trim()) return;

        try {
            const updated = await renameWorkspace(editingId, editName);
            setWorkspaces(workspaces.map(ws => ws.id === editingId ? updated : ws));
            if (activeWorkspace?.id === editingId) {
                setActiveWorkspaceState(updated);
            }
            setEditingId(null);
        } catch (error) {
            console.error("Failed to rename workspace:", error);
        }
    };

    const handleDelete = async (ws: Workspace, e: React.MouseEvent) => {
        e.stopPropagation();

        if (workspaces.length <= 1) {
            await ask("Cannot delete the last workspace.", { title: "Warning", kind: 'info' });
            return;
        }

        const confirmed = await ask(`Are you sure you want to delete workspace "${ws.name}"?\nThis will permanently delete all projects in this workspace.`, {
            title: 'Delete Workspace',
            kind: 'warning',
            okLabel: 'Delete',
            cancelLabel: 'Cancel'
        });

        if (confirmed) {
            try {
                await deleteWorkspace(ws.id);
                const isActive = activeWorkspace?.id === ws.id;
                await loadWorkspaces();
                if (isActive) {
                    await reloadSettings();
                    notifyWorkspaceChange();
                }
            } catch (error) {
                console.error("Failed to delete workspace:", error);
            }
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
                <div className="absolute top-full left-2 right-2 mt-2 bg-popover border border-border rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[400px]">
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {workspaces.map((ws) => (
                            <div
                                key={ws.id}
                                onClick={() => !editingId && handleSelect(ws)}
                                className={cn(
                                    "w-full flex items-center justify-between p-2 rounded-lg transition-colors group relative",
                                    editingId === ws.id ? "bg-accent" : "hover:bg-accent cursor-pointer"
                                )}
                            >
                                {editingId === ws.id ? (
                                    <form onSubmit={submitRename} className="flex items-center gap-2 w-full" onClick={e => e.stopPropagation()}>
                                        <input
                                            autoFocus
                                            type="text"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="flex-1 bg-background border border-primary/50 rounded px-2 py-1 text-sm focus:outline-none"
                                            onKeyDown={e => {
                                                if (e.key === 'Escape') setEditingId(null);
                                            }}
                                        />
                                        <button type="submit" className="p-1 hover:bg-primary/20 rounded text-primary">
                                            <Check className="w-3.5 h-3.5" />
                                        </button>
                                        <button type="button" onClick={() => setEditingId(null)} className="p-1 hover:bg-destructive/10 rounded text-destructive">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </form>
                                ) : (
                                    <>
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <span className={cn("text-sm truncate", activeWorkspace?.id === ws.id ? "text-primary font-medium" : "text-foreground")}>
                                                {ws.name}
                                            </span>
                                            {activeWorkspace?.id === ws.id && <Check className="w-3 h-3 text-primary shrink-0" />}
                                        </div>

                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => startEditing(ws, e)}
                                                className="p-1.5 rounded-md hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
                                                title="Rename"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={(e) => handleDelete(ws, e)}
                                                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="p-2 border-t border-border bg-accent/30 shrink-0">
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
