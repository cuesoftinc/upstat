import { calendarProps } from "@/types/calendar.type";
import { CalendarContainer, Header } from "./Calendar.styles";
import StatusHealth from "../statusHealth/StatusHealth";
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
