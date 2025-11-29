// admin-panel-frontend/src/context/RoomsContext.jsx
import React, { createContext, useContext } from "react";
import { useRooms as useRoomsHook } from "../hooks/useRooms";

const RoomsContext = createContext(null);

export function RoomsProvider({ children }) {
    const roomsState = useRoomsHook();
    return (
        <RoomsContext.Provider value={roomsState}>
            {children}
        </RoomsContext.Provider>
    );
}

export function useRoomsContext() {
    const ctx = useContext(RoomsContext);
    if (!ctx) {
        throw new Error("useRoomsContext must be used within a RoomsProvider");
    }
    return ctx;
}
