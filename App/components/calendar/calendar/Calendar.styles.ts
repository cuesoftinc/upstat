import styled from "styled-components";

export const CalendarContainer = styled.div`
  height: 400px;
  width: 90%;
  border-radius: 10px;
  background: #3c3c3c;
  transition: "opacity 0.3s ease-in-out";
`;

export const Header = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 20px 15px;
  border-bottom: 0.5px solid rgba(255, 255, 255, 0.5);

  p {
    font-family: Poppins;
    font-size: 20px;
    font-style: normal;
    color: #fff;
    font-weight: 500;
  }
`;
