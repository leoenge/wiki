import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider, RequireAuth } from "./lib/auth/AuthProvider.js";
import { AuthView } from "./views/AuthView.js";
import { CreatePageView } from "./views/CreatePageView.js";
import { PageView } from "./views/PageView.js";
import { PagesView } from "./views/PagesView.js";

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<PagesView />} />
            <Route path="/create" element={<RequireAuth><CreatePageView /></RequireAuth>} />
            <Route path="/auth" element={<AuthView />} />
            <Route
              path="/:tag"
              element={
                <RequireAuth>
                  <PageView />
                </RequireAuth>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
