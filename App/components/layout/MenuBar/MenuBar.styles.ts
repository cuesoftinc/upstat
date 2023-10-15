import { styled } from "styled-components";
import Link from "next/link";


const MenuBarContainer = styled.section`
    color: #fff;
    background: #3c3c3c;
    display: flex;
    flex-direction: column;
`

const HeadSection = styled.section`
    display: flex;
    gap: 24px;
    align-items: center;
    padding: 40px 16px 32px;

    span {
        font-size: 20px;
        font-weight: 600;
    }

    svg:hover {
        transform: scale(1.1)
    }
`

const MenuSection = styled.section`
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    border-top: 1px solid #fff;
    
`

const MenuTitle = styled.p`
    color:#fff;
    opacity: 0.5;
    text-align: center;
    font-weight: 700;
`

const MenuItem = styled(Link)<{ isActive: boolean }>`
    display: flex;
    align-items: center;
    gap: 16px;
    justify-content: start;
    padding: 15px 30px;
    border-radius: 10px;
    background: ${({isActive}) => isActive ? "rgba(0, 224, 158, 0.62)" : ""};

    &:hover {
        background: rgba(0, 224, 158, 0.62);
    }

    p , svg {
       color: white;
    }
`

const LogoutItem = styled(MenuItem)`
    background: rgba(0, 224, 158, 0.62);
    justify-content: center;
`

export { 
    MenuBarContainer, 
    MenuSection, 
    HeadSection, 
    LogoutItem,
    MenuTitle, 
    MenuItem 
}