
import { MainLayout } from "./layouts/MainLayout";
import { Projects } from "./pages/Projects";
import { Dashboards } from "./pages/Dashboards";
import { Settings } from "./pages/Settings";
import { AppProvider, useApp } from "./context/AppContext";

function AppContent() {
  const { activePage } = useApp();

  return (
    <MainLayout activePage={activePage}>
      {activePage === "projects" && <Projects />}
      {activePage === "dashboards" && <Dashboards />}
      {activePage === "favourites" && <Projects favouritesOnly />}
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
