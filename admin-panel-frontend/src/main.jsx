import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

// Using deduplicated stable console component
import ChatOpsConsoleStable from "./ChatOpsConsoleStable";
// import ChatOpsConsole from "./ChatOpsConsole"; // legacy mixed file retained for reference (will remove later)
// import MainInfraPage from "./MainInfraPage"; // Design Lab (swap back when needed)

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ChatOpsConsoleStable />
  </React.StrictMode>
);
