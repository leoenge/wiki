import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Navigate,
  RouterProvider,
  createBrowserRouter,
} from "react-router-dom";

import { AuthProvider, RequireAuth } from "./lib/auth/AuthProvider.js";
import { AuthView } from "./views/AuthView.js";
import { CreatePageView } from "./views/CreatePageView.js";
import { JoinView } from "./views/JoinView.js";
import { PageView } from "./views/PageView.js";
import { PagesView } from "./views/PagesView.js";

const queryClient = new QueryClient();

const router = createBrowserRouter([
  { path: "/", element: <PagesView /> },
  {
    path: "/create",
    element: (
      <RequireAuth>
        <CreatePageView />
      </RequireAuth>
    ),
  },
  { path: "/auth", element: <AuthView /> },
  { path: "/join/:token", element: <JoinView /> },
  {
    path: "/:tag",
    element: (
      <RequireAuth>
        <PageView />
      </RequireAuth>
    ),
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
