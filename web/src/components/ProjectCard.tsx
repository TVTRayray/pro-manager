import { Play, Settings, Trash2, Folder, Square, Star } from "lucide-react";
import { cn } from "../lib/utils";
import type { Project } from "../types";

interface ProjectCardProps {
    project: Project;
    isRunning: boolean;
    isFavouritePending: boolean;
    onLaunch: (project: Project) => void;
    onStop: (project: Project) => void;
    onFavourite: (project: Project) => void;
    onEdit: (project: Project) => void;
    onDelete: (project: Project) => void;
}

export function ProjectCard({ project, isRunning, isFavouritePending, onLaunch, onStop, onFavourite, onEdit, onDelete }: ProjectCardProps) {
    // Unified accent color style for icon and badge
    const accentStyle = "text-primary bg-primary/10 border-primary/20";
    return (
        <article className="group relative flex min-h-48 flex-col gap-3 rounded-xl border border-border bg-card p-4 hover:border-input">
            <div className="flex items-start justify-between">
                <div className={cn("rounded-lg border p-2", accentStyle)}>
                    <Folder className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-2">
                    <span className={cn("rounded border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide", accentStyle)}>{project.openConfig.mode.replace('_', ' ')}</span>
                    <button onClick={() => onFavourite(project)} disabled={isFavouritePending} aria-label={project.isFavourite ? `Remove ${project.name} from favourites` : `Add ${project.name} to favourites`} aria-pressed={project.isFavourite} className="icon-button disabled:cursor-not-allowed disabled:opacity-50">
                        <Star className={cn("h-4 w-4", project.isFavourite && "fill-current text-amber-500")} />
                    </button>
                </div>
            </div>

            <div>
                <h3 className="mb-1 truncate text-sm font-semibold text-foreground" title={project.name}>{project.name}</h3>
                <p className="text-xs text-muted-foreground truncate font-mono" title={project.path}>{project.path}</p>
            </div>

            <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
                {isRunning ? (
                    <button
                        onClick={() => onStop(project)}
                        className="flex h-8 flex-1 items-center justify-center gap-2 rounded-md bg-destructive text-xs font-semibold text-destructive-foreground hover:bg-destructive/90"
                    >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        Stop
                    </button>
                ) : (
                    <button
                        onClick={() => onLaunch(project)}
                        className="flex h-8 flex-1 items-center justify-center gap-2 rounded-md bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        Launch
                    </button>
                )}

                <button
                    onClick={() => onEdit(project)}
                    aria-label={`Edit ${project.name}`}
                    className="icon-button h-8 w-8 border border-input"
                >
                    <Settings className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onDelete(project)}
                    aria-label={`Delete ${project.name}`}
                    className="icon-button h-8 w-8 border border-input hover:text-destructive"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            </div>
        </article>
    );
}
