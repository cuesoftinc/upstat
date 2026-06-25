"use client";

import { ThemeProvider } from "styled-components";
import { darkTheme } from "@/components/libs/theme2"; 
import { Icon } from "@iconify/react";
import Image from "next/image";
import women from "../../components/assets/images/women.png";
import Notification from "@/components/ui/notification/page";
import { useGoogleAuth } from "@/components/hooks/useGoogleAuth";
import {
    LoginContainer,
    FormSection,
    FormHeading,
    GoogleBtn,
} from "./login.styles";

export default function LoginPage() {
    const { handleAuthSubmit, isLoading, error } = useGoogleAuth();

    return (
        <ThemeProvider theme={darkTheme}>
            <LoginContainer>
                <Image
                    src={women}
                    alt="women-talking"
                    style={{ width: "50%", height: "auto", alignSelf: "end" }}
                    priority
                />

                <FormSection>
                    <FormHeading>
                        <h1>Sign in to Upstat</h1>
                        <p>Welcome back. Sign in or create an account to get started.</p>
                        {error !== "" && <Notification msg={error} type="error" />}
                    </FormHeading>

                    <GoogleBtn disabled={isLoading} onClick={handleAuthSubmit}>
                        <Icon icon="devicon:google" />
                        <span>{isLoading ? "Connecting..." : "Continue with Google"}</span>
                    </GoogleBtn>
                </FormSection>
            </LoginContainer>
        </ThemeProvider>
    );
}