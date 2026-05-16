import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type UiScale = "compact" | "default" | "comfortable";

/** Tamanho base da fonte (rem-based) para cada escala da interface */
const SCALE_FONT_SIZE: Record<UiScale, string> = {
  compact: "15px",
  default: "16px",
  comfortable: "18px",
};

const UI_SCALES: UiScale[] = ["compact", "default", "comfortable"];

const SCALE_KEY = "ui-scale";
const MOTION_KEY = "reduce-motion";

interface PreferencesContextType {
  uiScale: UiScale;
  setUiScale: (scale: UiScale) => void;
  reduceMotion: boolean;
  setReduceMotion: (value: boolean) => void;
}

const PreferencesContext = createContext<PreferencesContextType | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [uiScale, setUiScaleState] = useState<UiScale>(() => {
    const saved = localStorage.getItem(SCALE_KEY) as UiScale | null;
    return saved && UI_SCALES.includes(saved) ? saved : "default";
  });

  const [reduceMotion, setReduceMotionState] = useState<boolean>(
    () => localStorage.getItem(MOTION_KEY) === "true",
  );

  useEffect(() => {
    document.documentElement.style.fontSize = SCALE_FONT_SIZE[uiScale];
    localStorage.setItem(SCALE_KEY, uiScale);
  }, [uiScale]);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = String(reduceMotion);
    localStorage.setItem(MOTION_KEY, String(reduceMotion));
  }, [reduceMotion]);

  return (
    <PreferencesContext.Provider
      value={{
        uiScale,
        setUiScale: setUiScaleState,
        reduceMotion,
        setReduceMotion: setReduceMotionState,
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (context === undefined) {
    throw new Error("usePreferences must be used within a PreferencesProvider");
  }
  return context;
}
