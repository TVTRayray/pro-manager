import { Search } from "lucide-react";
import { useApp } from "../context/AppContext";

export function Topbar() {
    const { searchQuery, setSearchQuery } = useApp();

    return (
        <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-background z-10 text-foreground transition-colors duration-300">
            <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-muted-foreground">工作台</span>
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
            </div>
        </div>
    );
}
