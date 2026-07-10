"use client";

import { useRef } from "react";
import { ThemeProvider } from "styled-components";
import { GoogleLogin } from "@react-oauth/google";
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
    HiddenGoogleButtonWrapper,
} from "./login.styles";

export default function LoginPage() {
    const { handleBackendAuthentication, handleAuthError, isLoading, error } = useGoogleAuth();
    const hiddenButtonRef = useRef<HTMLDivElement>(null);

    const triggerGoogleLogin = () => {
        const realButton = hiddenButtonRef.current?.querySelector(
            'div[role="button"]'
        ) as HTMLElement | null;
        realButton?.click();
    };

    return (
        <ThemeProvider theme={darkTheme}>
            <LoginContainer>

                <Image
                    src={women}
                    alt="women-talking"
                    className="login-illustration"
                    priority
                />

                <FormSection>
                    <FormHeading>
                        <h1>Sign up with Upstat</h1>
                        <p>Welcome back. Sign in or create an account to get started.</p>
                        {error !== "" && <Notification msg={error} type="error" />}
                    </FormHeading>

                    <GoogleBtn disabled={isLoading} onClick={triggerGoogleLogin}>
                        <Icon icon="flat-color-icons:google" />
                        <span>{isLoading ? "Connecting..." : "Continue with Google"}</span>
                    </GoogleBtn>

                    <HiddenGoogleButtonWrapper ref={hiddenButtonRef}>
                        <GoogleLogin
                            onSuccess={handleBackendAuthentication}
                            onError={handleAuthError}
                        />
                    </HiddenGoogleButtonWrapper>
                </FormSection>

            </LoginContainer>
        </ThemeProvider>
    );
}