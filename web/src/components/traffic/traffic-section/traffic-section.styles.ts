import styled from "styled-components";

const NewUserContainer = styled.section`
  width: 30%;
  height: 398px;
  background: #3c3c3c;
  border-radius: 10px;
`;

const TrafficSection = styled.div`
  padding-top: 2rem;
  width: 100%;

  .headerTitle {
    font-size: 20px;
    padding-bottom: 30px;
  }
`;

const UserHeader = styled.div`
  display: flex;
  color: #fff;
  justify-content: space-between;
  padding: 20px 20px;
  border-bottom: 2px solid #9d9d9d;

  .user_header {
    display: flex;
    gap: 6px;
  }
  .span {
    opacity: 0.5;
  }
`;

const UserSection = styled.div`
  display: flex;
  flex-direction: column;
  padding-top: 5px;
`;

const UserItem = styled.div`
  display: flex;
  flex-direction: column;
  padding-top: 20px;
  color: #fff;
`;

const UserItemCard = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 0 20px;

  .userItem_card {
    display: flex;
    gap: 8px;
    color: #fff;
    justify-items: center;
    align-items: center;

    span {
      opacity: 0.5;
    }
  }
`;

const UserButton = styled.button`
  display: flex;
  padding: 12px 16px;
  align-items: flex-end;
  gap: 5px;
  background: rgba(0, 224, 158, 0.62);
  border-radius: 10px;
  outline: none;
  margin-top: 5px;
  cursor: pointer;
  align-items: center;
  justify-items: center;
  color: #fff;
  border: none;
  margin: 0 auto;

  &:hover {
    opacity: 0.5;
  }
`;

const PageViewWrapper = styled.section`
  width: 40%;
  height: 398px;
  background: #3c3c3c;
  position: relative;
  border-radius: 10px;
`;

const PageViewHeader = styled.div`
  display: flex;
  color: #fff;
  justify-content: space-between;
  padding: 20px 20px;
  border-bottom: 2px solid #9d9d9d;
`;

const PageViewItemContainer = styled.div`
  color: #fff;
  padding-top: 20px;
`;

const PageViewItemBox = styled.div`
  display: flex;
  flex-direction: column;
  padding-top: 20px;
`;

const PageViewItemCard = styled.div`
  display: flex;
  gap: 26px;
  padding: 0 20px;

  .pageItem_card {
    display: flex;
    gap: 8px;
    color: #fff;
    width: 100%;
    justify-items: center;
    align-items: center;

    .pageName {
      width: 90px;
    }
  }
`;

const ProgressInput = styled.progress`
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  border-radius: 15px;
  width: 80%;
  margin: 0;
  height: 15px;

  &::-webkit-progress-value {
    background-color: rgba(0, 224, 158, 0.62);
    border-radius: 15px;
  }

  &::-webkit-progress-bar {
    border: 0;
    border-radius: 15px;
    background: #fff;
  }
  &::-moz-progress-bar {
    background-color: rgba(0, 224, 158, 0.62);
  }
`;

const TotalView = styled.div`
  width: 55%;
  height: 400px;
  background: #3c3c3c;
  border-radius: 10px;
`;

const TotalViewHeader = styled.div`
  display: flex;
  color: #fff;
  justify-content: space-between;
  padding: 20px 20px;
  font-weight: 700px;
  border-bottom: 2px solid #9d9d9d;
`;

const DailyVisitorWrapper = styled.section`
  width: 65%;
  height: 398px;
  border-radius: 10px;
  background: #3c3c3c;
`;

const DailyVisitorHeader = styled.div`
  display: flex;
  color: #fff;
  justify-content: space-between;
  padding: 20px 20px;
  font-weight: 700px;
  border-bottom: 2px solid #9d9d9d;

  .selectButton {
    display: flex;
    gap: 8px;

    select {
      background: rgba(0, 224, 158, 0.62);
      color: #fff;
      padding: 10px;
      border: none;
      outline: none;
      border-radius: 5px;
    }
  }
`;

const DailyVisitorCard = styled.div`
  padding: 30px 20px;

  width: 100%;
  height: 280px;
`;

const UpperWrapper = styled.section`
  display: flex;
  gap: 25px;
  width: 100%;
`;

const LowerWrapper = styled.section`
  display: flex;
  width: 100%;
  gap: 25px;
  margin-top: 30px;
`;

const TotalChartContainer = styled.div`
  background: #3c3c3c;
  width: 100%;
  height: 280px;
  padding: 30px 20px;
  border-radius: 10px;
`;
export {
  NewUserContainer,
  UserHeader,
  TotalChartContainer,
  PageViewWrapper,
  TotalViewHeader,
  PageViewItemBox,
  DailyVisitorWrapper,
  DailyVisitorHeader,
  PageViewItemCard,
  PageViewHeader,
  ProgressInput,
  TotalView,
  DailyVisitorCard,
  UpperWrapper,
  PageViewItemContainer,
  LowerWrapper,
  UserSection,
  UserItem,
  TrafficSection,
  UserItemCard,
  UserButton,
};
