"use client";
import React from "react";
import { styled } from "styled-components";

const Notification = ({ msg, type }: { msg: string; type: string }) => {
  return <NotificationBox type={type}>{msg}</NotificationBox>;
};

const NotificationBox = styled.span<{ type: string }>`
  padding: 8px 10px;
  background: #fff;
  position: fixed;
  top: 15px;
  z-index: 99999;
  display: flex;
  align-items: center;
  border-radius: 5px;

  color: ${({ type }) => (type === "error" ? "#E63751" : "rgba(0, 224, 158)")};
`;
export default Notification;
