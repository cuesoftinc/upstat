"use client";

import React, { createContext, useContext, useReducer } from "react";
import { ThemeProvider } from "styled-components";
import { darkTheme, lightTheme } from "@/components/libs/theme2";

interface UserProfile {
  name: string;
  role: string;
  avatarUrl?: string;
}

interface AppState {
  isDarkMode: boolean;
  user: UserProfile;
}

type AppAction =
  | { type: "TOGGLE_THEME" }
  | { type: "SET_USER"; payload: Partial<UserProfile> }
  | { type: "RESET_USER" };

const initialState: AppState = {
  isDarkMode: true,
  user: {
    name: "User",
    role: "Job Role",
    avatarUrl: "",
  },
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "TOGGLE_THEME":
      return { ...state, isDarkMode: !state.isDarkMode };
    case "SET_USER":
      return { ...state, user: { ...state.user, ...action.payload } };
    case "RESET_USER":
      return { ...state, user: initialState.user };
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const activeTheme = state.isDarkMode ? darkTheme : lightTheme;

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <ThemeProvider theme={activeTheme}>
        {children}
      </ThemeProvider>
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}