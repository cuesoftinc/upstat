import { CalendarStatusBarProp } from "@/types/calendar.type";
import { StatusBarsContainer, StatusBar } from "./StatusHealth.styles";
import { ReactNode } from "react";

const CalendarStatusBar = ({ status }: CalendarStatusBarProp) => {
  let up: number = 0;
  let down: number = 0;

  for (let i = 0; i < status.length; i++) {
    if (status[i] === 1) {
      up++;
    } else if (status[i] === 0) {
      down++;
    }
  }

  const statusBarTsx: ReactNode = status.map((ev, i) => {
    return (
      <StatusBar key={i} color={ev} className={`${i == 0 ? "firstrow" : ""}`} />
    );
  });
  return <StatusBarsContainer>{statusBarTsx}</StatusBarsContainer>;
};

export default CalendarStatusBar;
