"use client"
import { styled } from "styled-components"
import { Icon } from '@iconify/react';
import Image from "next/image";
import profile from "../../../assets/images/profile.png"

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

const HeaderContainer = styled.div`
    grid-area: header;
    display: flex;
    padding: 43px 62px 21px 25px;
    gap: 29px;
`

const SearchBarContianer = styled.div`
    width: 60%;
    display: flex;
    padding: 13px 14px 13px 8px;
    justify-content: space-between;
    align-items: center;
    border-radius: 10px;
    border: 0.5px solid var(--font, #3C3C3C);
`

const IconContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 5px 24px;
    border-left: 2px #3c3c3c solid;
    border-right: 2px #3c3c3c solid;
`

const ProfileContainer = styled.div`
    display: flex;
    gap: 16px;
    align-item: center;
`

const Input = styled.input`
    border: none;
    min-width: 90%;
    outline: none;


    &:focus {
        outline: none;
    }
`

const DetailsContainer = styled.div`
    
`

const Position = styled.p`
    color: rgba(60, 60, 60, 0.50);
`

export default Header