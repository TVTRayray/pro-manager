import { LayoutDashboard, Folder, Star, Settings } from "lucide-react";
import { cn } from "../lib/utils";
import { WorkspaceSelector } from "./WorkspaceSelector";

interface SidebarProps {
    activePage: string;
    onNavigate: (page: string) => void;
}

const navItems = [
    { id: "projects", icon: Folder, label: "Projects" },
    { id: "dashboards", icon: LayoutDashboard, label: "Dashboards" },
    { id: "favourites", icon: Star, label: "Favourites" },
    { id: "settings", icon: Settings, label: "Settings" },
];

export function Sidebar({ activePage, onNavigate }: SidebarProps) {
    return (
        <div className="w-64 bg-[hsl(var(--sidebar-background))] border-r border-[hsl(var(--sidebar-border))] h-screen flex flex-col p-4 text-foreground transition-colors duration-300">
            <WorkspaceSelector />

            <div className="space-y-6">
                <div>
                    <h3 className="text-xs font-bold text-muted-foreground px-3 mb-3 tracking-wider uppercase">Main</h3>
                    <div className="space-y-1">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => onNavigate(item.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                                    activePage === item.id
                                        ? "bg-primary/10 text-primary border border-primary/20"
                                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                                )}
                            >
                                <item.icon className={cn("w-4 h-4", activePage === item.id ? "text-primary" : "text-muted-foreground")} />
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>


        </div>
    );
}
