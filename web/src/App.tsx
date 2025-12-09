
import { MainLayout } from "./layouts/MainLayout";
import { Projects } from "./pages/Projects";
import { Dashboards } from "./pages/Dashboards";
import { Settings } from "./pages/Settings";
import { AppProvider, useApp } from "./context/AppContext";

function AppContent() {
  const { activePage, setActivePage } = useApp();

  return (
    <MainLayout activePage={activePage} onNavigate={setActivePage}>
      {activePage === "projects" && <Projects />}
      {activePage === "dashboards" && <Dashboards />}
      {activePage === "favourites" && <div className="p-8 text-white">Favourites (Coming Soon)</div>}
      {activePage === "settings" && <Settings />}
    </MainLayout>
  );
}

function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}

export default App;
