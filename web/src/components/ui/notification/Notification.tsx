"use client";
import React from "react";
import { NotificationBox } from "./notification.styles";

export interface NotificationProps {
  msg?: string;
  type?: "error" | "success" | "info";
  className?: string;
  children?: React.ReactNode;
}

const Notification = ({ msg, type = "info", className, children }: NotificationProps) => {
  if (!msg && !children) return null;

  return (
    <NotificationBox type={type} className={className}>
      {msg || children}
    </NotificationBox>
  );
};

export default Notification;