import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app.tsx";
import { LanguageProvider } from "./lib/i18n/language.tsx";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) throw new Error("#root element missing from index.html");

createRoot(root).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);
