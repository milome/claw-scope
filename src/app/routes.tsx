import { createBrowserRouter, Outlet } from "react-router";
import { Shell } from "./components/Shell";
import { ProfileView } from "./components/views/ProfileView";
import { MemoryView } from "./components/views/MemoryView";
import { ConfigView } from "./components/views/ConfigView";
import { EvolutionView } from "./components/views/EvolutionView";
import { I18nProvider } from "./contexts/I18nContext";
import { OpenClawProvider } from "./contexts/OpenClawContext";

function RootProvider() {
  return (
    <I18nProvider>
      <OpenClawProvider>
        <Outlet />
      </OpenClawProvider>
    </I18nProvider>
  );
}

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RootProvider,
    children: [
      {
        path: "/",
        Component: Shell,
        children: [
          { index: true, Component: ProfileView },
          { path: "memory", Component: MemoryView },
          { path: "config", Component: ConfigView },
          { path: "evolution", Component: EvolutionView },
        ],
      }
    ]
  },
]);