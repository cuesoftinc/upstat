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
  TotalChartContainer,
} from "./TrafficSection.styles";
import { Icon } from "@iconify/react";

import Image from "next/image";
import { pageViewData, userdata } from "@/data/trafficData";
import LineChart from "../charts/LineChart";
import BarChart from "../charts/BarChat";

const TrafficComponent = () => {
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
      <p className="headerTitle">Web Traffic</p>
      <UpperWrapper>
        <TotalView>
          <TotalViewHeader>
            <p>632,853 Total Views</p>
            <Icon icon="ph:dots-three-vertical-bold" />
          </TotalViewHeader>
          <TotalChartContainer>
            <LineChart />
          </TotalChartContainer>
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
            <BarChart />
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

export default TrafficComponent;
