import styled from "styled-components";

export const WorkflowWrapper = styled.div`
  padding: 50px 0;
`;

export const WorkflowHeader = styled.h1`
  color: #fff;
  font-family: Poppins;
  font-size: 48px;
  font-weight: 600;
  text-align: center;

  span {
    color: #00a991;
  }
`;

export const WorkflowContainer = styled.div`
  display: flex;
  gap: 38px;
  width: 90%;
  margin-top: 45px;
  margin-left: auto;
  margin-right: auto;
`;

export const WorkflowCard = styled.div`
  width: 403px;
  height: 260px;
  border-radius: 5px;
  display: flex;
  flex-direction: column;
  justify-items: center;
  align-items: center;
  padding: 45px 15px;
  gap: 16px;
  background: rgba(217, 217, 217, 0.1);

  span {
    display: flex;
    align-items: center;
    justify-items: center;
    justify-content: center;
    font-size: 25px;
    background: #00a991;
    color: #fff;
    height: 50px;
    width: 50px;
    border-radius: 50px;
  }

  h2 {
    color: #fff;
    font-family: Poppins;
    font-size: 20px;
    font-weight: 600;
  }

  p {
    color: #fff;
    font-family: Poppins;
    font-size: 14px;
    font-weight: 400;
  }
`;
