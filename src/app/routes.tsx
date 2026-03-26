import { createBrowserRouter, Outlet } from "react-router";
import { Shell } from "./components/Shell";
import { ProfileView } from "./components/views/ProfileView";
import { MemoryView } from "./components/views/MemoryView";
import { ConfigView } from "./components/views/ConfigView";
import { EvolutionView } from "./components/views/EvolutionView";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Outlet,
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
