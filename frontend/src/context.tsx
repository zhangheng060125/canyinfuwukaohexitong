import { createContext, useContext } from "react";
import type { State, Standards, User, ModalSpec } from "./types";
export type AppContextType = {
  data: State;
  standards: Standards;
  user: User;
  refresh: () => Promise<void>;
  toast: (s: string, error?: boolean) => void;
  open: (m: ModalSpec) => void;
  close: () => void;
  go: (p: string) => void;
  setUser: (u: User) => void;
};
export const AppContext = createContext<AppContextType>(null!);
export const useApp = () => useContext(AppContext);
