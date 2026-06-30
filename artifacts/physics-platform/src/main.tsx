import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import { plPL } from "@clerk/localizations";
import App from "./App";
import "./index.css";

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!publishableKey) {
  throw new Error(
    "Brak klucza publicznego Clerk (VITE_CLERK_PUBLISHABLE_KEY).",
  );
}

// BASE_URL always ends with a trailing slash (e.g. "/" or "/app/"), so the auth
// routes stay correct under the artifact's base path.
const base = import.meta.env.BASE_URL;

createRoot(document.getElementById("root")!).render(
  <ClerkProvider
    publishableKey={publishableKey}
    localization={plPL}
    signInUrl={`${base}login`}
    signUpUrl={`${base}register`}
    afterSignOutUrl={`${base}login`}
  >
    <App />
  </ClerkProvider>,
);
