import styled from "styled-components";

const NewUserContainer = styled.section`
  width: 340px;
  height: 398px;
  background: #3c3c3c;
  border-radius: 10px;
`;

const TrafficSection = styled.div`
  padding-top: 10rem;
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
  padding-top: 10px;
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
  width: 479px;
  height: 398px;
  background: #3c3c3c;
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
  justify-content: space-between;
  padding: 0 20px;

  .pageItem_card {
    display: flex;
    gap: 8px;
    color: #fff;
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
  width: 247px;
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
  width: 618px;
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
  width: 751px;
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
  margin-left: 20px;
  margin-top: 6rem;
`;
const UpperWrapper = styled.section`
  display: flex;
  gap: 25px;
`;

const LowerWrapper = styled.section`
  display: flex;
  gap: 25px;
  margin-top: 30px;
`;
export {
  NewUserContainer,
  UserHeader,
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
