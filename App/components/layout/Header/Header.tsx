"use client"
import { Icon } from '@iconify/react';
import Image from "next/image";
import profile from "../../../assets/images/profile.png"
import {
    SearchBarContianer, 
    DetailsContainer, 
    ProfileContainer, 
    HeaderContainer, 
    IconContainer, 
    Position, 
    Input
} from "./Header.styles"


const Header = () => (
    <HeaderContainer>
        <SearchBarContianer>
            <Input type="text" placeholder="Search"/>
            <Icon icon="iconamoon:search-light" />
        </SearchBarContianer>
        <IconContainer>
            <Icon icon="tdesign:notification-filled" />
            <Icon icon="solar:moon-bold" />
        </IconContainer>
        <ProfileContainer>
            <Image src={profile} alt="profile" />
            <DetailsContainer>
                <p>Wasiu Abdusalam</p>
                <Position>Office Manager</Position>
            </DetailsContainer>
            <Icon icon="ph:dots-three-bold" />
        </ProfileContainer>
    </HeaderContainer>
)

export default Header