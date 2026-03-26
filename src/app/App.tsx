import { RouterProvider } from "react-router";
import { ThemeProvider } from "next-themes";
import { router } from "./routes";
import { I18nProvider } from "./contexts/I18nContext";
import { OpenClawProvider } from "./contexts/OpenClawContext";
import { Toaster } from "./components/ui/sonner";

export default function App() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
    >
      <I18nProvider>
        <OpenClawProvider>
          <RouterProvider router={router} />
          <Toaster position="top-right" />
        </OpenClawProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
