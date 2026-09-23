import React from "react";
import { createRoot } from "react-dom/client";
import { RecommendationPage } from "./pages/RecommendationPage";
import "./styles/app.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><RecommendationPage /></React.StrictMode>,
);
