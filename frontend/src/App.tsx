import { StrictMode, useEffect, useState } from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import LoginPage from "./pages/Login";
import { DocumentList, Header } from "./pages/Documents";
import EditorPage from "./pages/Editor";
import { me, storedUser } from "./api";
import type { User } from "./api";
import { useLogout } from "./pages/Documents";

function useSession(): { user: User | null; ready: boolean } {
  const [user, setUser] = useState<User | null>(storedUser());
  const [ready, setReady] = useState(!storedUser());
  useEffect(() => {
    if (!storedUser()) return;
    me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);
  return { user, ready };
}

function Shell({ page }: { page: React.ReactNode }) {
  const { user, ready } = useSession();
  const doLogout = useLogout();
  if (!ready) return <p className="empty-state">Loading…</p>;
  return (
    <>
      <Header user={user} onLogout={() => void doLogout()} />
      {user ? page : <Navigate to="/login" />}
    </>
  );
}

const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/documents",
    element: (
      <Shell page={<DocumentList />} />
    ),
  },
  {
    path: "/documents/:id",
    element: (
      <Shell page={<EditorPage />} />
    ),
  },
  { path: "/", element: <Navigate to="/documents" /> },
]);

export default function App() {
  return (
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
}
