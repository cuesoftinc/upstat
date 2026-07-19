import styled from "styled-components";

const AccountInfoSection = styled.section`
  margin-left: 5rem;
`;

const ProfileContainer = styled.div`
  display: flex;
  gap: 16px;
  color: #fff;

  align-items: center;
  p {
    font-size: 16px;
    font-weight: 600;
  }
  span {
    opacity: 0.6;
  }

  .image {
    border-radius: 20rem;
  }
`;

const ProfileButton = styled.button`
  color: #fff;
  background: rgba(0, 224, 158, 0.62);

  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  padding: 16px;
  border: none;
  outline: none;
  color: #fff;
  gap: 10px;
`;

const InputGroup = styled.form`
  margin-top: 35px;
`;

const InputBox = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  padding-top: 20px;
  label {
    color: #fff;
    font-size: 20px;
    font-weight: 500;

    width: 125px;
  }

  input,
  select {
    width: 700px;
    padding: 21px 20px 21px 26px;
    border-radius: 5px;
    border: 1px solid #fff;
    color: #fff;
    font-size: 20px;
    opacity: 0.6;
    font-weight: 500;
    background: transparent;

    &:focus {
      outline: none;
    }
  }
`;

const InputBtnGroup = styled.div`
  display: flex;
  gap: 15px;
  font-size: 20px;
  margin-top: 55px;
  margin-left: 10rem;

  Button {
    display: flex;
    padding: 16px 32px;
    justify-content: center;
    align-items: center;
    gap: 10px;
    font-size: 20px;
    border-radius: 5px;

    outline: none;
    border: none;
  }
`;
export {
  AccountInfoSection,
  ProfileContainer,
  ProfileButton,
  InputGroup,
  InputBtnGroup,
  InputBox,
};
