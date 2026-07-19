"use client";

import Topsection from "@/components/uptime/top-section/TopSection";
import { CalendarPagesContainer } from "./main-page.styles";
import MiddleSection from "../middle-section/MiddleSection";

const CalendarMainPage = () => {
  return (
    <CalendarPagesContainer>
      <Topsection system={"Calendar"} dot={false} back={true} />
      <MiddleSection />
    </CalendarPagesContainer>
  );
};

export default CalendarMainPage;
