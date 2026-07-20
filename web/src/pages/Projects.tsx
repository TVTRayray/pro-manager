import { useRef, useState, useEffect } from "react";
import { Plus, LayoutGrid, List as ListIcon, Search, Star } from "lucide-react";
import { ProjectCard } from "../components/ProjectCard";
import { ProjectListItem } from "../components/ProjectListItem";
import { ProjectModal } from "../components/ProjectModal";
import { WorkspaceSelector } from "../components/WorkspaceSelector";
import { fetchProjects, upsertProject, deleteProject, launchProject, getRunningProjects, setProjectFavourite, stopProject } from "../api";
import type { Project, ProjectInput, ViewMode } from "../types";
import { useApp } from "../context/AppContext";
import { ask } from "@tauri-apps/plugin-dialog";

export function Projects({ favouritesOnly = false }: { favouritesOnly?: boolean }) {
    const { searchQuery, setSearchQuery, workspaceVersion } = useApp();
    const [viewMode, setViewMode] = useState<ViewMode>("grid");
    const [projects, setProjects] = useState<Project[]>([]);
    const [runningProjects, setRunningProjects] = useState<Set<string>>(new Set());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<ProjectInput | undefined>(undefined);
    const [error, setError] = useState("");
    const [pendingFavourites, setPendingFavourites] = useState<Set<string>>(new Set());
    const pendingFavouritesRef = useRef(new Set<string>());

    useEffect(() => {
        loadProjects();
    }, [workspaceVersion]);

    useEffect(() => {
        const interval = setInterval(checkRunningStatus, 2000);
        checkRunningStatus();
        return () => clearInterval(interval);
    }, []);

    const loadProjects = async () => {
        try {
            const data = await fetchProjects();
            setProjects(data);
            setError("");
        } catch (error) {
            console.error("Failed to load projects:", error);
            setError(`Could not load projects: ${String(error)}`);
        }
    };

    const checkRunningStatus = async () => {
        try {
            const running = await getRunningProjects();
            setRunningProjects(new Set(running));
        } catch (error) {
            console.error("Failed to check running status:", error);
        }
    };

    const handleCreate = async (data: ProjectInput) => {
        try {
            await upsertProject(data);
            await loadProjects();
        } catch (error) {
            console.error("Failed to create project:", error);
            setError(`Could not save project: ${String(error)}`);
            throw error;
        }
    };

    const handleDelete = async (project: Project) => {
        const confirmed = await ask(`Are you sure you want to delete "${project.name}"?`, {
            title: 'Delete Project',
            kind: 'warning',
            okLabel: 'Delete',
            cancelLabel: 'Cancel'
        });

        if (confirmed) {
            try {
                await deleteProject(project.id);
                await loadProjects();
            } catch (error) {
                console.error("Failed to delete project:", error);
                setError(`Could not delete project: ${String(error)}`);
            }
        }
    };

    const handleLaunch = async (project: Project) => {
        try {
            await launchProject(project.id);
            checkRunningStatus(); // Immediate check
        } catch (error) {
            console.error("Failed to launch project:", error);
            setError(`Could not launch project: ${String(error)}`);
        }
    };

    const handleStop = async (project: Project) => {
        try {
            await stopProject(project.id);
            await checkRunningStatus();
        } catch (error) {
            console.error("Failed to stop project:", error);
            setError(`Could not stop project: ${String(error)}`);
        }
    };

    const handleFavourite = async (project: Project) => {
        if (pendingFavouritesRef.current.has(project.id)) return;
        pendingFavouritesRef.current.add(project.id);
        setPendingFavourites(new Set(pendingFavouritesRef.current));
        try {
            const updated = await setProjectFavourite(project.id, !project.isFavourite);
            setProjects((current) => current.map((item) => item.id === updated.id ? updated : item));
            setError("");
        } catch (error) {
            console.error("Failed to update favourite:", error);
            setError(`Could not update favourite: ${String(error)}`);
        } finally {
            pendingFavouritesRef.current.delete(project.id);
            setPendingFavourites(new Set(pendingFavouritesRef.current));
        }
    };

    const filteredProjects = projects.filter(p =>
        (!favouritesOnly || p.isFavourite) && (
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.path.toLowerCase().includes(searchQuery.toLowerCase())
        )
    );

    return (
        <div className="flex h-full flex-1 flex-col bg-background text-foreground">
            {/* Main Content */}
            <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5 lg:p-6">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h1 className="text-lg font-semibold tracking-tight">{favouritesOnly ? "Favourites" : "Projects"}</h1>
                        <p className="mt-0.5 text-xs text-muted-foreground">{favouritesOnly ? "Your starred projects" : "Launch and manage workspace projects"}</p>
                    </div>
                    <div className="w-48 shrink-0">
                        <WorkspaceSelector />
                    </div>
                </div>
                {error && <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center bg-card border border-border rounded-lg p-1">
                            <button
                                onClick={() => setViewMode("grid")}
                                aria-label="Grid view"
                                aria-pressed={viewMode === "grid"}
                                className={`rounded-md p-1.5 ${viewMode === "grid" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                aria-label="List view"
                                aria-pressed={viewMode === "list"}
                                className={`rounded-md p-1.5 ${viewMode === "list" ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                <ListIcon className="w-4 h-4" />
                            </button>
                        </div>
                        <span className="text-sm text-muted-foreground">
                            {filteredProjects.length} {filteredProjects.length === 1 ? "project" : "projects"}
                        </span>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none lg:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search..."
                                aria-label="Search projects"
                                className="h-8 w-full rounded-md border border-input bg-card pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                        {!favouritesOnly && <button
                            onClick={() => {
                                setEditingProject(undefined);
                                setIsModalOpen(true);
                            }}
                            className="flex h-8 items-center gap-2 whitespace-nowrap rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                        >
                            <Plus className="w-4 h-4" />
                            New Project
                        </button>}
                    </div>
                </div>

                {viewMode === "grid" ? (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                        {filteredProjects.map((project) => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                isRunning={runningProjects.has(project.id)}
                                isFavouritePending={pendingFavourites.has(project.id)}
                                onLaunch={handleLaunch}
                                onStop={handleStop}
                                onFavourite={handleFavourite}
                                onEdit={(p) => {
                                    setEditingProject({ ...p, openConfig: p.openConfig });
                                    setIsModalOpen(true);
                                }}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredProjects.map((project) => (
                            <ProjectListItem
                                key={project.id}
                                project={project}
                                isRunning={runningProjects.has(project.id)}
                                isFavouritePending={pendingFavourites.has(project.id)}
                                onLaunch={handleLaunch}
                                onStop={handleStop}
                                onFavourite={handleFavourite}
                                onEdit={(p) => {
                                    setEditingProject({ ...p, openConfig: p.openConfig });
                                    setIsModalOpen(true);
                                }}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                )}
                {filteredProjects.length === 0 && (
                    <div className="flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 text-center">
                        {favouritesOnly && <Star className="mb-3 h-5 w-5 text-muted-foreground" aria-hidden="true" />}
                        <p className="text-sm font-medium">{searchQuery ? "No matching projects" : favouritesOnly ? "No favourites yet" : "No projects yet"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{searchQuery ? "Try a different search." : favouritesOnly ? "Star a project to keep it here." : "Create a project to get started."}</p>
                    </div>
                )}
            </div>

            <ProjectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleCreate}
                initialData={editingProject}
            />
        </div>
    );
}
