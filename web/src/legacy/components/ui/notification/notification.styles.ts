import styled from "styled-components";
import { theme } from "@/components/libs/theme";

export const NotificationBox = styled.span<{ type: "error" | "success" | "info" }>`
  padding: ${theme.spacing.xs} ${theme.spacing.sm};
  background: ${theme.colors.backgroundSecondary};
  top: ${theme.spacing.sm};
  right: ${theme.spacing.sm};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: ${theme.borderRadius.sm};
  border: 1px solid ${theme.colors.border};
  font-family: ${theme.fonts.family};
  font-size: ${theme.fonts.sizes.sm};
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  width: auto;
  max-width: calc(100% - 32px);
  box-sizing: border-box;

  color: ${({ type }) => {
    if (type === "error") return "#E63751";
    if (type === "success") return "rgba(0, 224, 158)";
    return theme.colors.text || "#ffffff";
  }};

  @media (max-width: 480px) {
    top: auto;
    bottom: ${theme.spacing.sm};
    left: ${theme.spacing.sm};
    right: ${theme.spacing.sm};
    width: calc(100% - 32px);
    max-width: none;
    font-size: ${theme.fonts.sizes.md};
    padding: ${theme.spacing.sm};
  }
`;