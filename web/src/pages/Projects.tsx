import { useState, useEffect } from "react";
import { Plus, LayoutGrid, List as ListIcon, Search } from "lucide-react";
import { ProjectCard } from "../components/ProjectCard";
import { ProjectListItem } from "../components/ProjectListItem";
import { ProjectModal } from "../components/ProjectModal";
import { fetchProjects, upsertProject, deleteProject, launchProject, getRunningProjects } from "../api";
import type { Project, ProjectInput, ViewMode } from "../types";
import { useApp } from "../context/AppContext";
import { ask } from "@tauri-apps/plugin-dialog";

export function Projects() {
    const { searchQuery, setSearchQuery } = useApp();
    const [viewMode, setViewMode] = useState<ViewMode>("grid");
    const [projects, setProjects] = useState<Project[]>([]);
    const [runningProjects, setRunningProjects] = useState<Set<string>>(new Set());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<ProjectInput | undefined>(undefined);

    useEffect(() => {
        loadProjects();
        // Poll for running projects every 2 seconds
        const interval = setInterval(checkRunningStatus, 2000);
        checkRunningStatus(); // Initial check
        return () => clearInterval(interval);
    }, []);

    const loadProjects = async () => {
        try {
            const data = await fetchProjects();
            setProjects(data);
        } catch (error) {
            console.error("Failed to load projects:", error);
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
            }
        }
    };

    const handleLaunch = async (project: Project) => {
        try {
            await launchProject(project.id);
            checkRunningStatus(); // Immediate check
        } catch (error) {
            console.error("Failed to launch project:", error);
        }
    };

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.path.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex-1 flex flex-col h-full bg-background text-foreground transition-colors duration-300">
            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center bg-card border border-border rounded-lg p-1">
                            <button
                                onClick={() => setViewMode("grid")}
                                className={`p-2 rounded-md transition-all ${viewMode === "grid" ? "bg-primary/10 text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={`p-2 rounded-md transition-all ${viewMode === "list" ? "bg-primary/10 text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                <ListIcon className="w-4 h-4" />
                            </button>
                        </div>
                        <span className="text-sm text-muted-foreground">
                            {filteredProjects.length} projects
                        </span>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search..."
                                className="w-full pl-9 pr-4 py-1.5 rounded-md bg-card border border-input focus:border-primary/50 focus:bg-accent focus:outline-none text-xs text-foreground placeholder:text-muted-foreground transition-all"
                            />
                        </div>
                        <button
                            onClick={() => {
                                setEditingProject(undefined);
                                setIsModalOpen(true);
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition-all shadow-lg shadow-primary/20 text-sm font-bold"
                        >
                            <Plus className="w-4 h-4" />
                            New Project
                        </button>
                    </div>
                </div>

                {viewMode === "grid" ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredProjects.map((project) => (
                            <ProjectCard
                                key={project.id}
                                project={project}
                                isRunning={runningProjects.has(project.id)}
                                onLaunch={handleLaunch}
                                onEdit={(p) => {
                                    setEditingProject({ ...p, openConfig: p.openConfig });
                                    setIsModalOpen(true);
                                }}
                                onDelete={handleDelete}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {filteredProjects.map((project) => (
                            <ProjectListItem
                                key={project.id}
                                project={project}
                                onLaunch={handleLaunch}
                                onEdit={(p) => {
                                    setEditingProject({ ...p, openConfig: p.openConfig });
                                    setIsModalOpen(true);
                                }}
                                onDelete={handleDelete}
                            />
                        ))}
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
