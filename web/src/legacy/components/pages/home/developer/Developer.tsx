"use client";

import Image from "next/image";

import data from '../../../assets/images/data.png'
import native from '../../../assets/images/nativeIntegrations.png'
import appUI from '../../../assets/images/appUI.png'
import mobile from '../../../assets/images/mobileDemo.png'
import code from '../../../assets/images/code.png'
import jsUpstat from '../../../assets/images/jsUpstat.png'
import ibk from '../../../assets/images/ibukun-dairo.jpg'

import {
    DeveloperContainer,
    DeveloperHeader,
    DeveloperTitle,
    DeveloperTitleGreen,
    DeveloperSubtitle,
    FeatureBlock,
    FeatureIconWrapper,
    FeatureContent,
    FeatureTitle,
    FeatureDescription,
    FeatureImageWrapper,
    TestimonialBlock,
    TestimonialQuote,
    TestimonialAuthor,
    AuthorAvatar,
    AuthorDetails,
    PrimaryButton,
    AuthorName,
    AuthorRole,
} from "./developer.styles";

const features = [
    {
        icon: data,
        iconAlt: "data",
        iconWidth: 57,
        iconHeight: 123,
        title: "Import data from any data source.",
        description:
            "Connect to any database, SaaS tool, or GraphQL/REST API within a few clicks. Query your data directly using SQL or our query builder.",
        btnLabel: "12+ native integrations",
        image: native,
        imageAlt: "native-integrations",
        imageWidth: 756,
        imageHeight: 756,
    },
    {
        icon: appUI,
        iconAlt: "app-ui",
        iconWidth: 66,
        iconHeight: 153,
        title: "Construct the user interface by dragging and dropping widgets.",
        description:
            "Leverage over 30+ customizable widgets to craft a stunning, responsive UI within minutes, all without the need to write a single line of HTML/CSS.",
        btnLabel: "Start building with 30+ widgets",
        image: mobile,
        imageAlt: "mobile-preview",
        imageWidth: 507,
        imageHeight: 640,
    },
    {
        icon: code,
        iconAlt: "code",
        iconWidth: 57,
        iconHeight: 153,
        title: "Personalize and develop through coding.",
        description:
            "Compose in-line JavaScript or employ reusable code blocks to expand your app's functionality, tailor your UI, or implement conditional logic.",
        btnLabel: "Write Javascript in Upstat",
        image: jsUpstat,
        imageAlt: "js-upstat",
        imageWidth: 1132,
        imageHeight: 573,
    },
];

export default function Developer() {
    return (
        <DeveloperContainer>

            <DeveloperHeader>
                <DeveloperTitle>Upstat for
                    <DeveloperTitleGreen>&nbsp;developer</DeveloperTitleGreen>
                </DeveloperTitle>
                <DeveloperSubtitle>
                    Build, maintain, and deploy internal tools 10X faster
                </DeveloperSubtitle>
            </DeveloperHeader>

            {features.map((feature, index) => (
                <FeatureBlock key={index}>

                    <FeatureIconWrapper>
                        <Image
                            src={feature.icon}
                            alt={feature.iconAlt}
                            width={feature.iconWidth}
                            height={feature.iconHeight}
                            style={{ objectFit: "contain" }}
                        />
                    </FeatureIconWrapper>


                    <FeatureContent>
                        <FeatureTitle>{feature.title}</FeatureTitle>
                        <FeatureDescription>{feature.description}</FeatureDescription>
                        <PrimaryButton
                            label={feature.btnLabel}
                            rightIcon="ph:arrow-right-bold"
                        />

                        <FeatureImageWrapper>
                            <Image
                                src={feature.image}
                                alt={feature.imageAlt}
                                width={feature.imageWidth}
                                height={feature.imageHeight}
                            // style={{ width: "100%", height: "auto" }}
                            />
                        </FeatureImageWrapper>
                    </FeatureContent>
                </FeatureBlock>
            ))}

            <TestimonialBlock>
                <TestimonialQuote>
                    "After experimenting with various low-code solutions, Upstat emerged
                    as the clear winner for our specific use case. The remarkable speed at
                    which you can assemble an internal tool is unparalleled. We seamlessly
                    integrated it with our data warehouse, Microsoft Teams, and our
                    logging, monitoring, and metrics infrastructure."
                </TestimonialQuote>
                <TestimonialAuthor>
                    <AuthorAvatar>
                        <Image
                            src={ibk}
                            alt="Ibukun Dairo"
                            width={48}
                            height={48}
                            style={{ borderRadius: "50%", objectFit: "cover" }}
                        />
                    </AuthorAvatar>
                    <AuthorDetails>
                        <AuthorName>Ibukun Dairo</AuthorName>
                        <AuthorRole>CEO, Cuesoft</AuthorRole>
                    </AuthorDetails>
                </TestimonialAuthor>
            </TestimonialBlock>

        </DeveloperContainer>
    );
}