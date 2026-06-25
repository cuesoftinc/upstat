const coreScales = {
  typography: {
    fontFamily: "'Poppins', sans-serif",
    sizes: {
      xs: "0.75rem",
      sm: "0.875rem",
      base: "1rem",
      lg: "1.125rem",
      xl: "1.25rem",
      xxl: "1.5rem",
      display: "2rem",
      hero: "3.5rem",
    },
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeights: {
      none: 1,
      tight: 1.25,
      snug: 1.375,
      normal: 1.5,
      relaxed: 1.625,
    }
  },
  
  spacing: {
    none: "0px",
    xs: "4px",
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "24px",
    xxl: "32px",
    layout: "48px",
    section: "64px",
  },

  borderRadius: {
    none: "0px",
    sm: "4px",
    md: "8px",
    lg: "12px",
    xl: "16px",
    full: "9999px",
  },

  transitions: {
    default: "all 0.2s ease-in-out",
    themeShift: "background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease",
  },
};

const palette = {
  primary: "#00A991",
  accent: "#00e5a0",
  red: "#E63751",
  
  green: {
    light: "#e6f6f4",
    lightHover: "#d9f2ef",
    lightActive: "#b0e4dd",
    normal: "#00a991",
    normalHover: "#009883",
    normalActive: "#008774",
    dark: "#007f6d",
    darkHover: "#006557",
    darkActive: "#004c41",
    darker: "#003b33",
  },

  white: {
    light: "#ffffff",
    lightHover: "#ffffff",
    lightActive: "#ffffff",
    normal: "#ffffff",
    normalHover: "#e6e6e6",
    normalActive: "#cccccc",
    dark: "#bfbfbf",
    darkHover: "#999999",
    darkActive: "#737373",
    darker: "#595959",
  },

  grey: {
    light: "#ececec",
    lightHover: "#e2e2e2",
    lightActive: "#c3c3c3",
    normal: "#3c3c3c",
    normalHover: "#363636",
    normalActive: "#303030",
    dark: "#2d2d2d",
    darkHover: "#242424",
    darkActive: "#1b1b1b",
    darker: "#151515",
  },
};

export const darkTheme = {
  ...coreScales,
  isDark: true,
  colors: {
    brand: palette.primary,
    brandAccent: palette.accent,
    error: palette.red,

    surface: {
      main: "#16151C",
      sidebar: "#1E1D26",
      card: "#1E1D26",
      actionable: palette.green.normal,
    },

    text: {
      primary: "#ffffff",
      secondary: "rgba(255, 255, 255, 0.7)",
      muted: "rgba(255, 255, 255, 0.5)",
    },

    border: {
      subtle: "#3c3c3c",
    },

    menu: {
      itemActive: palette.green.darkActive,
      itemHover: palette.green.darkHover,
    }
  },
};

export const lightTheme = {
  ...coreScales,
  isDark: false,
  colors: {
    brand: palette.primary,
    brandAccent: palette.accent,
    error: palette.red,

    surface: {
      main: "#F9FAFB",
      sidebar: "#ffffff",
      card: "#ffffff",
      actionable: palette.green.normal,
    },

    text: {
      primary: "#16151C",
      secondary: "#4B5563",
      muted: "#9CA3AF",
    },

    border: {
      subtle: "#E5E7EB",
    },

    menu: {
      itemActive: palette.green.lightActive,
      itemHover: palette.green.lightHover,
    }
  },
};

export type AppTheme = typeof darkTheme;