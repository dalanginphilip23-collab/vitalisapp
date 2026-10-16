import { AppProviders } from "./app/providers/index.jsx";
import AppRoutes from "./app/routes/AppRoutes.jsx";
import { ENV_ERROR } from "./app/config/env.js";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";

export default function App() {
  return (
    <ErrorBoundary>
    <div className="w-full min-h-screen">
      {ENV_ERROR ? (
        <p role="alert" className="bg-[var(--error)] text-[var(--text-inverse)] px-3 py-2 text-xs text-center font-semibold">
          {ENV_ERROR}
        </p>
      ) : null}
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </div>
    </ErrorBoundary>
  );
}