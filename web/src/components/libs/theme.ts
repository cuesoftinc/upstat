export const theme = {
  colors: {
    primary: '#00A991',
    background: "#16151C",
    backgroundSecondary: "#1E1D26",
    accent: "#00e5a0",
    text: "#ffffff",
    textMuted: "rgba(255, 255, 255, 0.5)",
    border: "#3c3c3c",

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
  },

  fonts: {
    family: "'Poppins', sans-serif",
    sizes: {
      sm: "0.875rem",
      md: "1rem",
      lg: "1.25rem",
      xl: "1.5rem",
      xxl: "2rem",
      hero: "4rem",
    },
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },

  spacing: {
    xs: "8px",
    sm: "16px",
    md: "24px",
    lg: "32px",
    xl: "48px",
    xxl: "80px",
  },

  borderRadius: {
    sm: "6px",
    md: "10px",
    lg: "16px",
  },
};

export type AppTheme = typeof theme;