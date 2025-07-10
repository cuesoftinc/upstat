export type calendarDataType = {
  id: number;
  option: string;
  data: calendarProps[];
}[];

export type CalendarStatusBarProp = {
  status: (0 | 1)[];
};

export type calendarProps = {
  name: string;
  percentage: number;
  status: (0 | 1)[];
};
