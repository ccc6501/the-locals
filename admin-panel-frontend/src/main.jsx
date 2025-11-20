import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";

import ChatOpsConsole from "./ChatOpsConsole"; // use the new chat UI for now
// import MainInfraPage from "./MainInfraPage"; // Design Lab (swap back when needed)

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ChatOpsConsole />
  </React.StrictMode>
);
