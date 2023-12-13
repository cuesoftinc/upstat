import styled from "styled-components";

export const SectionWrapper = styled.div`
  min-height: 100vh;
`;

export const SelectWrapper = styled.select`
  display: inline-flex;
  padding: 10px 19px;
  justify-content: center;
  width: 250px;
  outline: none;
  align-items: flex-start;
  gap: 318px;
  margin-top: 20px;
  flex-shrink: 0;
  border-radius: 10px;
  background: #3c3c3c;
  font-family: Poppins;
  font-size: 24px;
  font-style: normal;
  font-weight: 500;
  color: #fff;
`;
export const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  color: #fff;

  .select_container {
    p {
      font-family: Poppins;
      font-size: 24px;
      font-style: normal;
      font-weight: 500;
    }

    .selectBtn {
      display: inline-flex;
      height: 86px;
      padding: 25px 22px 25px 19px;
      justify-content: center;
      align-items: flex-start;
      gap: 318px;
      flex-shrink: 0;
      border-radius: 10px;
      background: #3c3c3c;
      color: #fff;
    }
  }

  .period_container {
    display: flex;
    gap: 15px;
    .icon {
      cursor: pointer;
    }
    p {
      font-family: Poppins;
      font-size: 24px;
      font-style: normal;
      font-weight: 500;
      line-height: normal;
      text-decoration-line: underline;
    }
  }
`;

export const CalendarWrapper = styled.div`
  display: flex;
  gap: 20px;
  width: 100%;
  padding: 65px 20px 45px 10px;
  flex-direction: row;
`;
