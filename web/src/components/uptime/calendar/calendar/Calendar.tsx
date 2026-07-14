import { calendarProps } from "@/types/calendar.type";
import { CalendarContainer, Header } from "./calendar.styles";
import StatusHealth from "../status-health/StatusHealth";
const Calendar = ({ name, percentage, status }: calendarProps) => {
  return (
    <CalendarContainer>
      <Header>
        <p>{name}</p>
        <p>{percentage}%</p>
      </Header>

      <StatusHealth status={status} />
    </CalendarContainer>
  );
};

export default Calendar;
