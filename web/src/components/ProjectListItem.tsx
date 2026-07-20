import { Play, Settings, Trash2, Terminal, Globe, Box, Square, Star } from "lucide-react";
import { cn } from "../lib/utils";
import type { Project } from "../types";

interface ProjectListItemProps {
    project: Project;
    isRunning: boolean;
    isFavouritePending: boolean;
    onLaunch: (project: Project) => void;
    onStop: (project: Project) => void;
    onFavourite: (project: Project) => void;
    onEdit: (project: Project) => void;
    onDelete: (project: Project) => void;
}

const typeIcons = {
    system_default: Globe,
    custom_app: Box,
    custom_command: Terminal,
};

export function ProjectListItem({ project, isRunning, isFavouritePending, onLaunch, onStop, onFavourite, onEdit, onDelete }: ProjectListItemProps) {
    const Icon = typeIcons[project.openConfig.mode] || Globe;
    const accentStyle = "text-primary bg-primary/10 border-primary/20";

    const getConfigLabel = () => {
        if (project.openConfig.mode === 'custom_app') return "Custom App";
        if (project.openConfig.mode === 'custom_command') return "Command";
        return "System";
    };

    const getExecutableInfo = () => {
        if (project.openConfig.mode === 'custom_app') return project.openConfig.executable;
        if (project.openConfig.mode === 'custom_command') return project.openConfig.command;
        return "Default";
    };

    return (
        <article className="group flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-3 hover:border-input lg:flex-nowrap">
            <div className={cn("p-2.5 rounded-lg border shrink-0 transition-colors", accentStyle)}>
                <Icon className="w-5 h-5" />
            </div>

            <div className="grid min-w-44 flex-1 grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(160px,1.5fr)_auto_minmax(100px,0.9fr)] sm:gap-4">
                <div className="min-w-0">
                    <h3 className="font-bold text-sm text-foreground truncate" title={project.name}>{project.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono truncate mt-0.5" title={project.path}>{project.path}</p>
                </div>

                <div className="flex items-center justify-start">
                    <span className={cn("inline-flex h-7 min-w-[76px] items-center justify-center rounded-full border px-2.5 text-[10px] font-bold uppercase tracking-wide transition-colors whitespace-nowrap", accentStyle)}>
                        {getConfigLabel()}
                    </span>
                </div>

                <div className="min-w-0">
                    <p className="text-xs text-muted-foreground font-mono truncate" title={getExecutableInfo()}>{getExecutableInfo()}</p>
                </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
                <button onClick={() => onFavourite(project)} disabled={isFavouritePending} aria-label={project.isFavourite ? `Remove ${project.name} from favourites` : `Add ${project.name} to favourites`} aria-pressed={project.isFavourite} className="icon-button disabled:cursor-not-allowed disabled:opacity-50">
                    <Star className={cn("h-4 w-4", project.isFavourite && "fill-current text-amber-500")} />
                </button>
                <button
                    onClick={() => onEdit(project)}
                    aria-label={`Edit ${project.name}`}
                    className="icon-button"
                >
                    <Settings className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onDelete(project)}
                    aria-label={`Delete ${project.name}`}
                    className="icon-button hover:text-destructive"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
                <button
                    onClick={() => isRunning ? onStop(project) : onLaunch(project)}
                    className={cn("flex h-8 items-center gap-2 rounded-md px-3 text-xs font-semibold text-primary-foreground", isRunning ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90")}
                >
                    {isRunning ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
                    {isRunning ? "Stop" : "Launch"}
                </button>
            </div>
        </article>
    );
}
