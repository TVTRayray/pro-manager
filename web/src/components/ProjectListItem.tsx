import { Play, Settings, Trash2, Terminal, Globe, Box } from "lucide-react";
import { cn } from "../lib/utils";
import type { Project } from "../types";

interface ProjectListItemProps {
    project: Project;
    onLaunch: (project: Project) => void;
    onEdit: (project: Project) => void;
    onDelete: (project: Project) => void;
}

const typeIcons = {
    system_default: Globe,
    custom_app: Box,
    custom_command: Terminal,
};

export function ProjectListItem({ project, onLaunch, onEdit, onDelete }: ProjectListItemProps) {
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
        <div className="group flex items-center gap-4 p-4 bg-card border border-border rounded-lg hover:border-border/80 transition-all">
            <div className={cn("p-2.5 rounded-lg border shrink-0 transition-colors", accentStyle)}>
                <Icon className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0 grid grid-cols-[minmax(180px,1.5fr)_auto_minmax(120px,0.9fr)] gap-4 items-center">
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

            <div className="flex items-center gap-2 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={() => onEdit(project)}
                    className="p-2 rounded-md hover:bg-accent text-muted-foreground transition-colors"
                >
                    <Settings className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onDelete(project)}
                    className="p-2 rounded-md hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onLaunch(project)}
                    className="h-8 px-3 rounded-md text-xs font-bold flex items-center gap-2 transition-colors bg-primary text-primary-foreground hover:bg-primary/90"
                >
                    <Play className="w-3 h-3 fill-current" />
                    Launch
                </button>
            </div>
        </div>
    );
}
