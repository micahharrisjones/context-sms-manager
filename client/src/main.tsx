import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./lib/mixpanel"; // Initialize Mixpanel

createRoot(document.getElementById("root")!).render(<App />);
