"use client";
import { Icon } from "@iconify/react";
import {
  PrimaryButton,
  SecondaryButton,
  TextButton,
} from "./button.styles";

interface ButtonProps {
  label: string;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
  leftIcon?: string;
  rightIcon?: string;
  className?: string;
}

export function PrimaryBtn({
  label,
  onClick,
  type = "button",
  disabled,
  leftIcon,
  rightIcon,
  className, 
}: ButtonProps) {
  return (
    <PrimaryButton
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={className} 
    >
      {leftIcon && <Icon icon={leftIcon} />}
      {label}
      {rightIcon && <Icon icon={rightIcon} />}
    </PrimaryButton>
  );
}

export function SecondaryBtn({
  label,
  onClick,
  type = "button",
  disabled,
  leftIcon,
  rightIcon,
  className, 
}: ButtonProps) {
  return (
    <SecondaryButton
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={className} 
    >
      {leftIcon && <Icon icon={leftIcon} />}
      {label}
      {rightIcon && <Icon icon={rightIcon} />}
    </SecondaryButton>
  );
}

export function TextBtn({
  label,
  onClick,
  type = "button",
  disabled,
  leftIcon,
  rightIcon,
  className,
}: ButtonProps) {
  return (
    <TextButton
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {leftIcon && <Icon icon={leftIcon} />}
      {label}
      {rightIcon && <Icon icon={rightIcon} />}
    </TextButton>
  );
}