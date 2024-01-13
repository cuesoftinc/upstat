"use client"
import Image from "next/image"
import logo from "@/assets/logos/logo.png"
import { Icon } from '@iconify/react'
import { useState } from "react"
import { usePathname } from "next/navigation"
import { 
    MenuBarContainer,
    HeadSection,
    MenuSection,
    LogoutItem,
    MenuTitle,
    MenuItem
} from "./MenuBar.styles"
import { accountData, menudata } from "@/data/menuBar.data"


const MenuBar = () => {
    const [isOpen, setIsOpen] = useState<boolean>(false)
    const pathname = usePathname()

    const menuJsx = menudata.map(el => (
        <MenuItem 
            href={el.path} key={el.id}
            isActive={pathname === el.path}
        >
            <Icon icon={el.icon} />
            {isOpen && <p>{el.name}</p>}
        </MenuItem>
    ))

    const accountJsx = accountData.map(el => (
        <MenuItem
            href={el.path} key={el.id}
            isActive={pathname === el.path}
        >
            <Icon icon={el.icon} />
            {isOpen && <p>{el.name}</p>}
        </MenuItem>
    ))

 return (
    <MenuBarContainer>
        <HeadSection>
            <Image src={logo} alt="logo" />
            {isOpen && <span>Upstat</span>}
            <Icon 
                icon={`ri:arrow-${isOpen ? "left" : "right"}-double-line`}
                onClick={() => setIsOpen(!isOpen)}
                style={{cursor: "pointer"}}
            />
        </HeadSection>
        <MenuSection>
            <MenuTitle>MENU</MenuTitle>
            {menuJsx}
        </MenuSection>
        <MenuSection>
            <MenuTitle>ACCOUNTS</MenuTitle>
            {accountJsx}
        </MenuSection>
        <MenuSection>
            <LogoutItem href="">
                <Icon icon="majesticons:logout" />
            </LogoutItem>
        </MenuSection>
    </MenuBarContainer>
 )
}


export default MenuBar