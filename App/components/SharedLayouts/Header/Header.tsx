"use client";
import { Icon } from "@iconify/react";
import Image from "next/image";
import profile from "../../../assets/images/profile.png";
import {
  SearchBarContianer,
  DetailsContainer,
  ProfileContainer,
  HeaderContainer,
  IconContainer,
  Position,
  Input,
} from "./Header.styles";

const Header = () => {
  const userString = localStorage.getItem("user");

  const user = userString ? JSON.parse(userString) : null;
  return (
    <HeaderContainer>
      <SearchBarContianer>
        <Input type="text" placeholder="Search" />
        <Icon icon="iconamoon:search-light" />
      </SearchBarContianer>
      <IconContainer>
        <Icon icon="tdesign:notification-filled" />
        <Icon icon="solar:moon-bold" />
      </IconContainer>
      <ProfileContainer>
        <Image src={profile} alt="profile" />
        <DetailsContainer>
          {user && <p>{user.name}</p>}
          {/* <Position>Office Manager</Position> */}
        </DetailsContainer>
        <Icon icon="ph:dots-three-bold" />
      </ProfileContainer>
    </HeaderContainer>
  );
};

export default Header;
