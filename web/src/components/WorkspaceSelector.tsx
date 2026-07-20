import { useRef, useState, useEffect } from "react";
import { ChevronDown, Plus, Check, Edit2, Trash2, X } from "lucide-react";
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
    const [error, setError] = useState("");
    const [isSwitching, setIsSwitching] = useState(false);
    const isSwitchingRef = useRef(false);

    const { notifyWorkspaceChange } = useApp();

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
            setError("");
        } catch (error) {
            console.error("Failed to load workspaces:", error);
            setError(`Could not load workspaces: ${String(error)}`);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newWorkspaceName.trim() || isSwitchingRef.current) return;

        try {
            const newWs = await createWorkspace({ name: newWorkspaceName, description: "" });
            setWorkspaces([...workspaces, newWs]);
            await handleSelect(newWs);
            setNewWorkspaceName("");
            setIsCreating(false);
        } catch (error) {
            console.error("Failed to create workspace:", error);
            setError(`Could not create workspace: ${String(error)}`);
        }
    };

    const handleSelect = async (workspace: Workspace) => {
        if (isSwitchingRef.current || workspace.id === activeWorkspace?.id) return;
        isSwitchingRef.current = true;
        setIsSwitching(true);
        try {
            await setActiveWorkspace(workspace.id);
            setActiveWorkspaceState(workspace);
            setIsOpen(false);
            notifyWorkspaceChange();
        } catch (error) {
            console.error("Failed to set active workspace:", error);
            setError(`Could not switch workspace: ${String(error)}`);
        } finally {
            isSwitchingRef.current = false;
            setIsSwitching(false);
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
            setError(`Could not rename workspace: ${String(error)}`);
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
                    notifyWorkspaceChange();
                }
            } catch (error) {
                console.error("Failed to delete workspace:", error);
                setError(`Could not delete workspace: ${String(error)}`);
            }
        }
    };

    return (
        <div data-tauri-drag-region="false" className="relative w-full min-w-0">
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-expanded={isOpen}
                aria-haspopup="menu"
                className="flex h-8 w-full min-w-0 items-center justify-between rounded-md border border-transparent px-2 hover:border-border hover:bg-accent"
            >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-primary">
                        <span className="text-[10px] font-bold text-primary-foreground">
                            {activeWorkspace?.name.substring(0, 2).toUpperCase() || "WS"}
                        </span>
                    </div>
                    <div className="flex min-w-0 items-center overflow-hidden">
                        <span className="w-full truncate text-left text-xs font-medium text-foreground">
                            {activeWorkspace?.name || "Select Workspace"}
                        </span>
                    </div>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div role="menu" className="absolute right-0 top-full z-50 mt-2 flex max-h-[min(400px,70vh)] w-[min(16rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
                    {error && <div role="alert" className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</div>}
                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {workspaces.map((ws) => (
                            <div
                                key={ws.id}
                                className={cn(
                                    "group relative flex w-full items-center justify-between rounded-lg p-1",
                                    editingId === ws.id && "bg-accent"
                                )}
                            >
                                {editingId === ws.id ? (
                                    <form onSubmit={submitRename} className="flex items-center gap-2 w-full" onClick={e => e.stopPropagation()}>
                                        <input
                                            autoFocus
                                            type="text"
                                            value={editName}
                                            onChange={(e) => setEditName(e.target.value)}
                                            className="flex-1 rounded border border-primary/50 bg-background px-2 py-1 text-sm"
                                            onKeyDown={e => {
                                                if (e.key === 'Escape') setEditingId(null);
                                            }}
                                        />
                                        <button type="submit" aria-label="Save workspace name" className="p-1 hover:bg-primary/20 rounded text-primary">
                                            <Check className="w-3.5 h-3.5" />
                                        </button>
                                        <button type="button" onClick={() => setEditingId(null)} aria-label="Cancel workspace rename" className="p-1 hover:bg-destructive/10 rounded text-destructive">
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </form>
                                ) : (
                                    <>
                                        <button type="button" role="menuitem" onClick={() => void handleSelect(ws)} disabled={isSwitching} className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-md px-1 py-1 text-left hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50">
                                            <span className={cn("text-sm truncate", activeWorkspace?.id === ws.id ? "text-primary font-medium" : "text-foreground")}>
                                                {ws.name}
                                            </span>
                                            {activeWorkspace?.id === ws.id && <Check className="w-3 h-3 text-primary shrink-0" />}
                                        </button>

                                        <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 group-focus-within:opacity-100">
                                            <button
                                                onClick={(e) => startEditing(ws, e)}
                                                className="p-1.5 rounded-md hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
                                                title="Rename"
                                                aria-label={`Rename ${ws.name}`}
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={(e) => handleDelete(ws, e)}
                                                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                                title="Delete"
                                                aria-label={`Delete ${ws.name}`}
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
                                    className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm text-foreground"
                                />
                                <div className="flex gap-2">
                                    <button
                                        type="submit"
                                        disabled={isSwitching}
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
