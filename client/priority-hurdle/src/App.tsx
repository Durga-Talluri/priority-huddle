// client/src/App.tsx

import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AppProviders } from "./ApolloProvider";

// Import pages
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import HomePage from "./pages/HomePage";
import BoardPage from "./pages/BoardPage";

// Helper component to protect routes
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const token = localStorage.getItem("token");

  if (!token) {
    // Redirect to login if no token is found
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

function App() {
  return (
    <AppProviders>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          {/* Protected Routes (Require Auth) */}
          <Route
            path="/home"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/board/:boardId"
            element={
              <ProtectedRoute>
                {/* Note: BoardPage needs the boardId from the URL params */}
                <BoardPage/>
                {/* A better way is using useParams, but this works for simple setup */}
              </ProtectedRoute>
            }
          />

          {/* Default Route */}
          <Route
            path="/"
            element={
              <Navigate
                to={localStorage.getItem("token") ? "/home" : "/login"}
                replace
              />
            }
          />
          <Route
            path="*"
            element={
              <p className="text-center mt-20 text-2xl">404 - Not Found</p>
            }
          />
        </Routes>
      </Router>
    </AppProviders>
  );
}

export default App;
