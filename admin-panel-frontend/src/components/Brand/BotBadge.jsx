import React from "react";
import { Bot } from "lucide-react";

const BotBadge = () => (
    <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-sky-500 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-sky-500/40">
        <Bot className="w-5 h-5 text-white" />
    </div>
);

export default BotBadge;
