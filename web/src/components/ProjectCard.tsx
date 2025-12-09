import { Play, Settings, Trash2, Folder, Square } from "lucide-react";
import { cn } from "../lib/utils";
import type { Project } from "../types";
import { useState } from "react";
import { stopProject } from "../api";

interface ProjectCardProps {
    project: Project;
    isRunning: boolean;
    onLaunch: (project: Project) => void;
    onEdit: (project: Project) => void;
    onDelete: (project: Project) => void;
}

export function ProjectCard({ project, isRunning, onLaunch, onEdit, onDelete }: ProjectCardProps) {
    // Unified accent color style for icon and badge
    const accentStyle = "text-primary bg-primary/10 border-primary/20";
    const [isStopping, setIsStopping] = useState(false);

    const handleStop = async () => {
        setIsStopping(true);
        try {
            await stopProject(project.id);
        } catch (error) {
            console.error("Failed to stop project:", error);
        } finally {
            setIsStopping(false);
        }
    };

    return (
        <div className="group bg-card/50 backdrop-blur-sm border border-border rounded-xl p-5 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 flex flex-col gap-4 relative overflow-hidden">
            {/* Glassmorphism gradient blob for light mode */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors pointer-events-none" />

            <div className="flex items-start justify-between relative z-10">
                <div className={cn("p-2.5 rounded-lg border transition-colors", accentStyle)}>
                    <Folder className="w-5 h-5" />
                </div>
                <span className={cn("text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider transition-colors", accentStyle)}>
                    {project.openConfig.mode.replace('_', ' ')}
                </span>
            </div>

            <div className="relative z-10">
                <h3 className="font-bold text-lg mb-1 text-foreground group-hover:text-primary transition-colors truncate" title={project.name}>{project.name}</h3>
                <p className="text-xs text-muted-foreground truncate font-mono" title={project.path}>{project.path}</p>
            </div>

            <div className="mt-auto pt-4 flex items-center gap-2 relative z-10">
                {isRunning ? (
                    <button
                        onClick={handleStop}
                        disabled={isStopping}
                        className="flex-1 bg-destructive text-destructive-foreground h-9 rounded-md text-sm font-bold hover:bg-destructive/90 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-destructive/20 animate-in fade-in"
                    >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        {isStopping ? "Stopping..." : "Stop"}
                    </button>
                ) : (
                    <button
                        onClick={() => onLaunch(project)}
                        className="flex-1 bg-primary text-primary-foreground h-9 rounded-md text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
                    >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Launch
                    </button>
                )}

                <button
                    onClick={() => onEdit(project)}
                    className="h-9 w-9 flex items-center justify-center rounded-md border border-input hover:bg-accent text-muted-foreground transition-colors bg-background/50"
                >
                    <Settings className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onDelete(project)}
                    className="h-9 w-9 flex items-center justify-center rounded-md border border-input hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors bg-background/50"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
