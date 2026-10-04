import { createContext, useContext, useEffect, useState } from "react";
import { FaSun, FaMoon } from "react-icons/fa";

// Create Context
const ThemeContext = createContext();

// ✅ Provider
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState("light");

  // Init theme
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");

    if (
      savedTheme === "dark" ||
      (!savedTheme &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      setTheme("dark");
      document.documentElement.classList.add("dark");
    } else {
      setTheme("light");
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // Toggle theme
  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";

    document.documentElement.classList.toggle("dark");
    localStorage.setItem("theme", newTheme);
    setTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// ✅ Hook
export const useTheme = () => useContext(ThemeContext);

// ✅ Reusable Button Component
export const ThemeToggleButton = ({ className = "" }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`flex items-center justify-center w-8 h-8 rounded-full border hover:bg-gray-200 dark:hover:bg-gray-700 transition ${className}`}
    >
      {theme === "dark" ? (
        <FaSun className="w-5 h-5 text-white" />
      ) : (
        <FaMoon className="w-5 h-5 text-gray-700" />
      )}
    </button>
  );
};