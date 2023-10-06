"use client"
import { styled } from "styled-components"

const Header = () => (
    <HeaderContainer>
        <h1>This is Header</h1>
    </HeaderContainer>
)

const HeaderContainer = styled.header`
    display: flex;
    justify-content: center;
    padding-top: 20px
`

export default Header