import { useState, useEffect } from "react";
import { Activity, Zap, Folder, Calendar } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { getActivityStats } from "../api";
import type { ActivityStats } from "../types";
import { useApp } from "../context/AppContext";
import { cn } from "../lib/utils";
import { WorkspaceSelector } from "../components/WorkspaceSelector";

function DashboardHeader() {
    return (
        <div className="flex items-start justify-between gap-4">
            <div>
                <h1 className="text-lg font-semibold tracking-tight text-foreground">Dashboard</h1>
                <p className="mt-0.5 text-xs text-muted-foreground">Workspace launch activity</p>
            </div>
            <div className="w-48 shrink-0">
                <WorkspaceSelector />
            </div>
        </div>
    );
}

export function Dashboards() {
    const { accentColor, workspaceVersion } = useApp();
    const [stats, setStats] = useState<ActivityStats | null>(null);
    const [chartPeriod, setChartPeriod] = useState<"week" | "month">("month");

    useEffect(() => {
        loadStats();
    }, [workspaceVersion]);

    const loadStats = async () => {
        try {
            const data = await getActivityStats();
            setStats(data);
        } catch (error) {
            console.error("Failed to load stats:", error);
        }
    };

    if (!stats) return <div className="flex-1 space-y-4 overflow-y-auto bg-background p-4 text-foreground sm:p-6"><DashboardHeader /><p className="text-sm text-muted-foreground">Loading stats...</p></div>;

    const chartData = chartPeriod === "week" ? stats.weeklyActivity : stats.monthlyActivity;

    return (
        <div className="flex-1 space-y-4 overflow-y-auto bg-background p-4 text-foreground sm:p-6">
            <DashboardHeader />

            {/* Metrics Cards */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <MetricCard
                    icon={<Folder className="w-5 h-5" />}
                    title="Total projects"
                    value={stats.totalProjects}
                    color="text-purple-500"
                    bgColor="bg-purple-500/10"
                />
                <MetricCard
                    icon={<Zap className="w-5 h-5" />}
                    title="Total launches"
                    value={stats.totalLaunches}
                    color="text-primary"
                    bgColor="bg-primary/10"
                />
                <MetricCard
                    icon={<Activity className="w-5 h-5" />}
                    title="Average daily launches"
                    value={stats.averageDailyLaunches.toFixed(1)}
                    color="text-orange-500"
                    bgColor="bg-orange-500/10"
                />
            </div>

            {/* Main Activity Chart */}
            <section className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">Launch trends</h2>
                    <div className="flex bg-muted rounded-lg p-1">
                        <button
                            onClick={() => setChartPeriod("week")}
                            className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", chartPeriod === "week" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                        >
                            Week
                        </button>
                        <button
                            onClick={() => setChartPeriod("month")}
                            className={cn("px-3 py-1 text-xs font-medium rounded-md transition-colors", chartPeriod === "month" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                        >
                            Month
                        </button>
                    </div>
                </div>
                <div className="h-[300px] w-full select-none">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                            <XAxis
                                dataKey="date"
                                stroke="hsl(var(--foreground))"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => {
                                    const d = new Date(value);
                                    return chartPeriod === 'week'
                                        ? ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
                                        : d.getDate().toString();
                                }}
                                tick={{ fill: 'hsl(var(--foreground))', opacity: 0.8 }}
                            />
                            <YAxis
                                stroke="hsl(var(--foreground))"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                allowDecimals={false}
                                tick={{ fill: 'hsl(var(--foreground))', opacity: 0.8 }}
                            />
                            <Tooltip content={<CustomChartTooltip />} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1, strokeDasharray: '4 4' }} />
                            <Area
                                type="monotone"
                                dataKey="count"
                                stroke={accentColor}
                                strokeWidth={2}
                                fillOpacity={0}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </section>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {/* Contribution Graph */}
                <section className="flex flex-col rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 mb-6">
                        <Calendar className="w-4 h-4 text-foreground/80" />
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">Yearly activity</h2>
                    </div>
                    <div className="flex-1 flex items-center justify-center overflow-x-auto select-none">
                        <ContributionGraph data={stats.yearlyActivity} accentColor={accentColor} />
                    </div>
                </section>

                {/* Project Distribution */}
                <section className="flex flex-col rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-2 mb-6">
                        <Folder className="w-4 h-4 text-foreground/80" />
                        <h2 className="text-xs font-semibold uppercase tracking-wider text-foreground/80">Project activity</h2>
                    </div>
                    <div className="h-[200px] w-full select-none">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.projectCounts} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    width={100}
                                    tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, opacity: 0.8 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip content={<CustomProjectTooltip />} cursor={{ fill: 'hsl(var(--accent))', opacity: 0.5 }} />
                                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                                    {stats.projectCounts.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={accentColor} fillOpacity={0.8 - (index * 0.05)} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </section>
            </div>
        </div>
    );
}

function MetricCard({ icon, title, value, color, bgColor }: { icon: React.ReactNode, title: string, value: string | number, color: string, bgColor: string }) {
    return (
        <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-start justify-between mb-4">
                <div className={cn("p-2 rounded-lg", bgColor, color)}>
                    {icon}
                </div>
            </div>
            <div className="space-y-1">
                <h3 className="text-2xl font-bold text-foreground">{value}</h3>
                <p className="text-sm text-muted-foreground">{title}</p>
            </div>
        </div>
    )
}

type ChartTooltipPayload = {
    value: number;
};

type ChartTooltipProps = {
    active?: boolean;
    payload?: ChartTooltipPayload[];
    label?: string;
};

function CustomChartTooltip({ active, payload, label }: ChartTooltipProps) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-popover border border-border px-2 py-1 rounded shadow-md">
                <p className="text-[10px] text-popover-foreground">
                    <span className="font-medium">{new Date(label ?? "").toLocaleDateString()}</span>
                    <span className="mx-1">:</span>
                    <span className="font-bold">{payload[0].value} launches</span>
                </p>
            </div>
        );
    }
    return null;
}

function CustomProjectTooltip({ active, payload, label }: ChartTooltipProps) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-popover border border-border px-2 py-1 rounded shadow-md">
                <p className="text-[10px] text-popover-foreground">
                    <span className="font-medium">{label}</span>
                    <span className="mx-1">:</span>
                    <span className="font-bold">{payload[0].value} launches</span>
                </p>
            </div>
        );
    }
    return null;
}

function ContributionGraph({ data, accentColor }: { data: { date: string, count: number }[], accentColor: string }) {
    // Simple GitHub-style heatmap implementation
    // We need to group data by weeks for the grid
    // This is a simplified version; a robust one would handle start-of-week alignment perfectly

    // Generate full year grid (52 weeks x 7 days)
    // We'll just render the last ~150 days to fit nicely or full year if we can squeeze it
    // Let's do last 20 weeks for better visibility on small screens

    const weeks = [];
    let currentWeek = [];

    // Take last 140 days (20 weeks)
    const recentData = data.slice(-140);

    for (const day of recentData) {
        currentWeek.push(day);
        if (currentWeek.length === 7) {
            weeks.push(currentWeek);
            currentWeek = [];
        }
    }
    if (currentWeek.length > 0) weeks.push(currentWeek);

    const getOpacity = (count: number) => {
        if (count === 0) return 0.05;
        if (count <= 2) return 0.3;
        if (count <= 5) return 0.6;
        return 1;
    }

    return (
        <div className="flex gap-1">
            {weeks.map((week, i) => (
                <div key={i} className="flex flex-col gap-1">
                    {week.map((day) => (
                        <div
                            key={day.date}
                            className="group relative h-3 w-3 rounded-[2px]"
                            style={{
                                backgroundColor: day.count > 0 ? accentColor : 'currentColor',
                                opacity: day.count > 0 ? getOpacity(day.count) : 0.1,
                                color: 'hsl(var(--foreground))'
                            }}
                        >
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-popover border border-border rounded shadow-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-20">
                                <p className="text-[10px] text-popover-foreground">
                                    <span className="font-medium">{day.date}</span>
                                    <span className="mx-1">:</span>
                                    <span className="font-bold">{day.count} launches</span>
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    )
}
