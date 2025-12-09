import { Sidebar } from "../components/Sidebar";
import { TitleBar } from "../components/TitleBar";

interface MainLayoutProps {
    children: React.ReactNode;
    activePage: string;
    onNavigate: (page: string) => void;
}

export function MainLayout({ children, activePage, onNavigate }: MainLayoutProps) {
    return (
        <div className="flex flex-col h-screen w-full bg-[#0d1117] text-gray-200 overflow-hidden font-sans">
            <TitleBar />
            <div className="flex-1 flex overflow-hidden">
                <Sidebar activePage={activePage} onNavigate={onNavigate} />
                <main className="flex-1 flex flex-col overflow-hidden relative bg-[#0d1117]">
                    {children}
                </main>
            </div>
        </div>
    );
}
