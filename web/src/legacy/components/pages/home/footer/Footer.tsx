"use client";

import Image from "next/image";
import { Icon } from "@iconify/react";
import logo from "../../../assets/logos/upstat-white.png";


import {
    FooterContainer,
    MainContentRow,
    BrandColumn,
    BrandDescription,
    LinksGrid,
    LinksColumn,
    ColumnTitle,
    FooterLinkWrapper,
    ContactItem,
    TextButton,
    BottomDivider,
    BottomRow,
    CopyrightText,
    SocialLinksGroup,
    SocialIconCircle,
} from "./footer.styles";

interface FooterLinkItem {
    label: string;
    href?: string;
}

interface FooterColumn {
    title: string;
    isContact?: boolean;
    items: FooterLinkItem[];
}

const footerLinksData: FooterColumn[] = [
    {
        title: "Product",
        items: [
            { label: "Roadmaps" },
            { label: "Integration" },
            { label: "Template" },
            { label: "Changelog" },
        ],
    },
    {
        title: "Solution",
        items: [
            { label: "Customer Support" },
            { label: "Enterprise" },
            { label: "All use cases" },
        ],
    },
    {
        title: "Resources",
        items: [
            { label: "Blog" },
            { label: "Videos" },
            { label: "Tutorials" },
            { label: "Customers" },
            { label: "Partners" },
        ],
    },
    {
        title: "Contact",
        isContact: true,
        items: [
            { label: "+1 302 359 6437", href: "tel:+13023596437" },
            { label: "+234 902 850 9478", href: "tel:+2349028509478" },
            { label: "hello@cuesoft.io", href: "mailto:hello@cuesoft.io" },
        ],
    },
];

const socialLinksData = [
    { icon: "ph:discord-logo", label: "Discord", size: "16" },
    { icon: "ph:linkedin-logo", label: "LinkedIn", size: "16" },
    { icon: "ph:x-logo", label: "X / Twitter", size: "14" },
    { icon: "ph:github-logo", label: "GitHub", size: "16" },
];


export default function Footer() {
    return (
        <FooterContainer>
            <MainContentRow>

                <BrandColumn>
                    <Image
                        src={logo}
                        alt="Upstat Logo"
                        width={105}
                        height={56}
                        style={{ objectFit: "contain" }}
                    />
                    <BrandDescription>
                        We help users to track and monitor the performance of a system which enhances the user experience.
                    </BrandDescription>
                </BrandColumn>

                <LinksGrid>
                    {footerLinksData.map((column, colIndex) => (
                        <LinksColumn key={colIndex}>
                            <ColumnTitle>{column.title}</ColumnTitle>
                            {column.items.map((item, itemIndex) =>
                                column.isContact ? (
                                    <ContactItem key={itemIndex} href={item.href}>
                                        {item.label}
                                    </ContactItem>
                                ) : (
                                    <FooterLinkWrapper key={itemIndex}>
                                        <TextButton label={item.label} />
                                    </FooterLinkWrapper>
                                )
                            )}
                        </LinksColumn>
                    ))}
                </LinksGrid>

            </MainContentRow>

            <BottomDivider />

            <BottomRow>
                <CopyrightText>© Upstat {new Date().getFullYear()}. All rights reserved.</CopyrightText>
                <SocialLinksGroup>
                    {socialLinksData.map((social, index) => (
                        <SocialIconCircle key={index} href="#" aria-label={social.label}>
                            <Icon icon={social.icon} width={social.size} height={social.size} />
                        </SocialIconCircle>
                    ))}
                </SocialLinksGroup>
            </BottomRow>

        </FooterContainer>
    );
}
