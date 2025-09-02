"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

type Theme = "light" | "dark" | "auto";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  // Get user settings from Convex
  const userSettings = useQuery(api.settings.getUserSettings);
  const updateTheme = useMutation(api.settings.updateTheme);

  // Update local theme state when settings load
  useEffect(() => {
    if (userSettings?.theme) {
      setThemeState(userSettings.theme);
    }
  }, [userSettings?.theme]);

  // Apply theme to document (only after mount)
  useEffect(() => {
    if (!mounted) return;
    console.log("Applying theme to document:", theme);
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    if (theme === "dark") {
      root.classList.add("dark");
      console.log("Added dark class to html element");
    } else if (theme === "light") {
      root.classList.add("light");
      console.log("Added light class to html element");
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      root.classList.add("dark");
      console.log("Added dark class for auto mode (system prefers dark)");
    } else {
      root.classList.add("light");
      console.log("Added light class for auto mode (system prefers light)");
    }

    // Debug: Check what classes are actually on the HTML element
    console.log("HTML element classes:", root.className);
    console.log(
      "CSS variable --background value:",
      getComputedStyle(root).getPropertyValue("--background")
    );
    console.log(
      "CSS variable --foreground value:",
      getComputedStyle(root).getPropertyValue("--foreground")
    );

    // Debug: Check if CSS variables are being applied to body as well
    const body = document.body;
    console.log(
      "Body computed background:",
      getComputedStyle(body).backgroundColor
    );
    console.log("Body computed color:", getComputedStyle(body).color);

    // Debug: Check if there are any CSS conflicts
    console.log("All CSS variables on html:", {
      background: getComputedStyle(root).getPropertyValue("--background"),
      foreground: getComputedStyle(root).getPropertyValue("--foreground"),
      card: getComputedStyle(root).getPropertyValue("--card"),
      "card-foreground":
        getComputedStyle(root).getPropertyValue("--card-foreground"),
      muted: getComputedStyle(root).getPropertyValue("--muted"),
      "muted-foreground":
        getComputedStyle(root).getPropertyValue("--muted-foreground"),
    });
  }, [theme, mounted]);

  // Listen for system theme changes in auto mode
  useEffect(() => {
    if (theme !== "auto") return;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const root = document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(mediaQuery.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  useEffect(() => setMounted(true), []);

  const setTheme = async (newTheme: Theme) => {
    try {
      console.log("Setting theme to:", newTheme);
      await updateTheme({ theme: newTheme });
      console.log("Theme updated in database, updating local state");
      setThemeState(newTheme);
    } catch (error) {
      console.error("Failed to update theme:", error);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {/* During SSR/first paint, avoid flicker by hiding content if not mounted yet */}
      {mounted ? (
        children
      ) : (
        <div style={{ visibility: "hidden" }}>{children}</div>
      )}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
