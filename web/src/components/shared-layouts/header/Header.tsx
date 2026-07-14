"use client";
import { Icon } from "@iconify/react";
import Image from "next/image";
import { useEffect, useState } from "react";
import profile from "../../../assets/images/profile.png";
import {
  SearchBarContianer,
  DetailsContainer,
  ProfileContainer,
  HeaderContainer,
  IconContainer,
  Position,
  Input,
} from "./header.styles";

const Header = () => {
  const [user, setUser] = useState<{ name?: string } | null>(null);

  useEffect(() => {
    // localStorage is browser-only; read after mount so SSR/prerender is safe.
    const userString = localStorage.getItem("user");
    setUser(userString ? JSON.parse(userString) : null);
  }, []);

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
