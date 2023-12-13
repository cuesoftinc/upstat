"use client";

import Topsection from "@/components/uptime/topSection/TopSection";
import { CalendarPagesContainer } from "./MainPage.styles";
import MiddleSection from "../middleSection/MiddleSection";

const CalendarMainPage = () => {
  return (
    <CalendarPagesContainer>
      <Topsection system={"Calendar"} dot={false} back={true} />
      <MiddleSection />
    </CalendarPagesContainer>
  );
};

export default CalendarMainPage;
