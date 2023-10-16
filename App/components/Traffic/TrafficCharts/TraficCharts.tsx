"use client";

import {
  NewUserContainer,
  PageViewWrapper,
  UserButton,
  UserHeader,
  UserItem,
  UserItemCard,
  PageViewHeader,
  UserSection,
  PageViewItemContainer,
  PageViewItemCard,
  TotalView,
  PageViewItemBox,
  UpperWrapper,
  TotalViewHeader,
  DailyVisitorHeader,
  LowerWrapper,
  DailyVisitorWrapper,
  DailyVisitorCard,
  TrafficSection,
  ProgressInput,
} from "./trafficChart.styles";
import { Icon } from "@iconify/react";
import user1 from "../../../assets/images/user1.png";
import user2 from "../../../assets/images/user2.png";
import user3 from "../../../assets/images/user3.png";
import user4 from "../../../assets/images/user4.png";
import Image from "next/image";
import { BarChart, IData } from "../BarChart";

const TrafficChart = () => {
  //NewUser data
  const userJsx = userdata.map((item) => (
    <UserItem key={item.id}>
      <UserItemCard>
        <div className="userItem_card">
          <Image src={item.image} alt="users" />
          <div>
            <p>{item.name}</p>
            <span>{item.country}</span>
          </div>
        </div>
        <Icon icon="ph:caret-right-bold" />
      </UserItemCard>
    </UserItem>
  ));

  //Page view data handling;

  const pageViewJsx = pageViewData.map((item) => (
    <PageViewItemBox key={item.id}>
      <PageViewItemCard>
        <div className="pageItem_card">
          <p className="pageName">{item.name}</p>
          <ProgressInput value={item.value} max={3000}></ProgressInput>
        </div>
        <p>{item.value}</p>
      </PageViewItemCard>
    </PageViewItemBox>
  ));
  return (
    <TrafficSection>
      <UpperWrapper>
        <TotalView>
          <TotalViewHeader>
            <p>632,853 Total Views</p>
            <Icon icon="ph:dots-three-vertical-bold" />
          </TotalViewHeader>
        </TotalView>
        <PageViewWrapper>
          <PageViewHeader>
            <p>Page Views</p>
            <Icon icon="ph:dots-three-vertical-bold" />
          </PageViewHeader>
          <PageViewItemContainer>{pageViewJsx}</PageViewItemContainer>
        </PageViewWrapper>
      </UpperWrapper>
      <LowerWrapper>
        <DailyVisitorWrapper>
          <DailyVisitorHeader>
            <p>Page Views</p>
            <div className="selectButton">
              <select name="" id="">
                <option value="">March</option>
              </select>
              <select name="" id="">
                <option value="">2023</option>
              </select>
            </div>
            <Icon icon="ph:dots-three-vertical-bold" />
          </DailyVisitorHeader>
          <DailyVisitorCard>
            <BarChart data={BAR_CHART_DATA} />
          </DailyVisitorCard>
        </DailyVisitorWrapper>
        <NewUserContainer>
          <UserHeader>
            <div className="user_header">
              <p>New Users</p>
              <span className="span">(1,463)</span>
            </div>
            <Icon icon="ph:dots-three-vertical-bold" />
          </UserHeader>

          <UserSection>{userJsx}</UserSection>
          <UserButton>
            View more{" "}
            <span>
              <Icon icon="ph:caret-down-bold" />
            </span>
          </UserButton>
        </NewUserContainer>
      </LowerWrapper>
    </TrafficSection>
  );
};

const userdata: {
  id: number;
  image: any;
  name: string;
  country: string;
}[] = [
  {
    id: 1,
    image: user1,
    name: "Sandra Smith",
    country: "London",
  },
  {
    id: 2,
    image: user2,
    name: "John Micheal",
    country: "Germany",
  },
  {
    id: 3,
    image: user3,
    name: "Baasit Quadri",
    country: "Nigeria",
  },
  {
    id: 4,
    image: user4,
    name: "Elizebath Yarr",
    country: "Ghana",
  },
];

//page view data
const pageViewData: {
  id: number;

  name: string;
  value: number;
}[] = [
  {
    id: 1,
    name: "Home",
    value: 2437,
  },
  {
    id: 2,
    name: "About",
    value: 1462,
  },
  {
    id: 3,
    name: "Product",
    value: 1121,
  },
  {
    id: 4,
    name: "FAQ",
    value: 585,
  },
  {
    id: 5,
    name: "Contact",
    value: 657,
  },
  {
    id: 6,
    name: "Contact",
    value: 420,
  },
  {
    id: 7,
    name: "Sign up",
    value: 1239,
  },
];

const BAR_CHART_DATA: IData[] = [
  { label: "1", value: 100 },
  { label: "2", value: 200 },
  { label: "3", value: 50 },
  { label: "4", value: 150 },
  { label: "5", value: 50 },
  { label: "6", value: 60 },
  { label: "7", value: 130 },
  { label: "8", value: 110 },
  { label: "9", value: 60 },
  { label: "10", value: 57 },
  { label: "11", value: 90 },
  { label: "12", value: 90 },
  { label: "13", value: 90 },
  { label: "14", value: 90 },
  { label: "15", value: 90 },
  { label: "16", value: 90 },
  { label: "17", value: 90 },
  { label: "18", value: 90 },
  { label: "19", value: 90 },
  { label: "20", value: 90 },
  { label: "21", value: 90 },
  { label: "22", value: 90 },
  { label: "23", value: 90 },
  { label: "24", value: 90 },
  { label: "25", value: 100 },
  { label: "26", value: 30 },
  { label: "27", value: 104 },
  { label: "28", value: 70 },
  { label: "29", value: 65 },
  { label: "30", value: 72 },
  { label: "31", value: 90 },
];
export default TrafficChart;
