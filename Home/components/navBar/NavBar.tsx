import React from "react";
import {
  HeaderWrapper,
  List,
  ListContainer,
  LoginWrapper,
  LogoImage,
} from "./NavBar.styles";
import logo from "../../assets/upstat_logo.png";
import { Icon } from "@iconify/react";

const NavBar = () => {
  return (
    <HeaderWrapper>
      <LogoImage src={logo} alt="logo" />
      <ListContainer>
        <div className="github">
          <span>
            <Icon icon="uiw:github" />
          </span>{" "}
          <p>18,439</p>
        </div>
        <List>
          <p>Product</p>
          <span>
            <Icon icon="ic:sharp-keyboard-arrow-down" />
          </span>
        </List>
        <List>
          <p>Solutions</p>
          <span>
            <Icon icon="ic:sharp-keyboard-arrow-down" />
          </span>
        </List>
        <List>
          <p>Resources</p>
          <span>
            <Icon icon="ic:sharp-keyboard-arrow-down" />
          </span>
        </List>
        <List>
          <p>Contact</p>
          <span>
            <Icon icon="ic:sharp-keyboard-arrow-down" />
          </span>
        </List>
        <p>Docs</p>
      </ListContainer>
      <LoginWrapper>
        <button className="login">Login</button>
        <button className="signup">Sign up</button>
      </LoginWrapper>
    </HeaderWrapper>
  );
};

export default NavBar;
