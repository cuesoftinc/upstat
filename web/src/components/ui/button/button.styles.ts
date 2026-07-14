import { styled } from "styled-components";
import { theme } from '../../libs/theme'

export const BaseButton = styled.button`
  border-radius: 5px;
  padding: 12px 16px;
  font-family: ${theme.fonts.family};
  font-weight: ${theme.fonts.weights.medium};
  font-size: ${theme.fonts.sizes.md};
  line-height: 100%;
  letter-spacing: 0%;
  cursor: pointer;
  border: none;
  transition: opacity 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;

  &:hover {
    opacity: 0.85;
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;

export const PrimaryButton = styled(BaseButton)`
  background: ${theme.colors.primary};
  color: ${theme.colors.text};
  justify-content: center;
`;

export const SecondaryButton = styled(BaseButton)`
  background: transparent;
  color: ${theme.colors.primary};
  border: 1px solid ${theme.colors.primary};
  justify-content: center;

  &:hover {
    opacity: 0.85;
  }
`;

export const TextButton = styled(BaseButton)`
  background: transparent;
  color: ${theme.colors.text};
  border: none;
  padding: 0;
  text-decoration: underline;
  border-radius: 0;

  &:hover {
    opacity: 0.85;
  }
`;