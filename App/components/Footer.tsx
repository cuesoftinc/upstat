"use client"
import { styled } from "styled-components"

const Footer = () => (
    <FooterContainer>
        <h1>This is Footer</h1>
    </FooterContainer>
)

const FooterContainer = styled.footer`
    display: flex;
    justify-content: center;
    padding-top: 20px
`

export default Footer