import { calendarData } from "@/data/calendar.data";
import {
  CalendarWrapper,
  SectionHeader,
  SectionWrapper,
  SelectWrapper,
} from "./MiddleSection.styles";
import { Icon } from "@iconify/react";
import React, { useState } from "react";
import Calendar from "../calendar/Calendar";

const MiddleSection = () => {
  const period = [
    "Jan 2023 to Mar 2023",
    "April 2023 to June 2023",
    "July 2023 to Sep 2023",
    "Oct 2023 to Dec 2023",
  ];

  const [currentPeriod, setCurrentPeriod] = useState<number>(0);
  const [selected, setSelected] = useState<string>("");
  const [selectedDataIndex, setSelectedDataIndex] = useState(0);

  const handleSelected = (ev: any) => {
    setSelected(ev.target.value);
  };

  const selectedData =
    calendarData
      .find((ev) => ev.option === selected)
      ?.data.slice(selectedDataIndex, selectedDataIndex + 3) || [];

  //handle previous functionality
  const handlePrevious = () => {
    const previousIndex: number = selectedDataIndex - 3;

    if (previousIndex >= 0) {
      setSelectedDataIndex(previousIndex);
      setCurrentPeriod((prevPeriod) => Math.max(prevPeriod - 1, 0));
    }
  };

  //handle next functionality
  const handleNext = () => {
    const selectedDataLength =
      calendarData.find((ev) => ev.option === selected)?.data.length || 0;
    const nextIndex: number = selectedDataIndex + 3;

    if (nextIndex < selectedDataLength) {
      setSelectedDataIndex(nextIndex);
      setCurrentPeriod((prevPeriod) =>
        Math.min(prevPeriod + 1, period.length - 1)
      );
    }
  };

  const calendarSystemTsx = selectedData.map((ev, i) => {
    return (
      <Calendar
        key={i}
        name={ev.name}
        percentage={ev.percentage}
        status={ev.status}
      />
    );
  });
  return (
    <SectionWrapper>
      <SectionHeader>
        <div className="select_container">
          <p>{selected} history logs</p>

          <SelectWrapper name="" id="" onChange={handleSelected}>
            {calendarData.map((ev) => (
              <option value={ev.option} key={ev.id}>
                {ev.option}
              </option>
            ))}
          </SelectWrapper>
        </div>
        <div className="period_container">
          <Icon
            icon="teenyicons:arrow-left-solid"
            className="icon"
            onClick={handlePrevious}
          />
          <p>{period[currentPeriod]}</p>
          <Icon
            icon="teenyicons:arrow-right-solid"
            className="icon"
            onClick={handleNext}
          />
        </div>
      </SectionHeader>
      <CalendarWrapper>{calendarSystemTsx}</CalendarWrapper>
    </SectionWrapper>
  );
};

export default MiddleSection;
