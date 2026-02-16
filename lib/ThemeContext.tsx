import React, { createContext, useContext, useState, useMemo } from 'react';
import { themes, themeOrder, type ThemeId, type ThemeColors, type ThemeCopy, type ThemeVisualStyle } from './themes';

type ThemeContextValue = {
  themeId: ThemeId;
  colors: ThemeColors;
  copy: ThemeCopy;
  visualStyle: ThemeVisualStyle;
  setThemeId: (id: ThemeId) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  themeId: 'original',
  colors: themes.original.colors,
  copy: themes.original.copy,
  visualStyle: themes.original.visualStyle,
  setThemeId: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeId, setThemeId] = useState<ThemeId>('original');

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId,
      colors: themes[themeId].colors,
      copy: themes[themeId].copy,
      visualStyle: themes[themeId].visualStyle,
      setThemeId,
    }),
    [themeId],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
