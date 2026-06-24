"use client";

import { ThemeProvider } from "styled-components";
import { darkTheme } from "@/components/libs/theme2"; 
import { Icon } from "@iconify/react";
import Image from "next/image";
import women from "../../components/assets/images/women.png";
import Link from "next/link";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Notification from "@/components/helpers/notification/Notification";
import {
  SignupContainer,
  FormSection,
  FormHeading,
  GoogleBtn,
} from "./Signup.styles";

export default function SignupPage() {
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const router = useRouter();

  const handleSignup = async (): Promise<void> => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await signIn("google", {
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (result?.error) {
        setError(result.error || "Authentication failed");
        setLoading(false);
        return;
      }

      if (result?.ok) {
        router.push("/dashboard");
      } else {
        setError("Unexpected error during authentication");
        setLoading(false);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Google signup failed";
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <SignupContainer>
        <Image
          src={women}
          alt="women-talking"
          style={{ width: "50%", height: "auto", alignSelf: "end" }}
          priority 
        />

        <FormSection>
          <FormHeading>
            <h1>Sign up with Upstat</h1>
            <p>
              Have an account?
              <Link href="/login">&nbsp;Login</Link>
            </p>
            {error !== "" && <Notification msg={error} type="error" />}
          </FormHeading>

          <GoogleBtn disabled={loading} onClick={handleSignup}>
            <Icon icon="devicon:google" />
            <span>{loading ? "Connecting..." : "Continue with Google"}</span>
          </GoogleBtn>
        </FormSection>
      </SignupContainer>
    </ThemeProvider>
  );
}
// import { AuthServiceClient } from "@/grpc/generated/AuthServiceClient"; 
// import { SignUpRequest } from "@/grpc/generated/auth_pb";

// // Inside your component:
// const [loading, setLoading] = useState(false);
// const router = useRouter();

// // 1. Initialize the client to talk to Envoy on port 8081
// const client = new AuthServiceClient("http://localhost:8081");

// const handleGoogleSuccess = async (tokenResponse: any) => {
//   setLoading(true);
//   try {
//     // The access token or credential token from Google
//     const token = tokenResponse.access_token || tokenResponse.credential; 

//     // 2. Build the gRPC Request message
//     const request = new SignUpRequest();
//     request.setGoogleToken(token); // Use the exact field name from your backend guy's .proto file

//     // 3. Fire it through Envoy straight to Go
//     const response = await client.signUpWithGoogle(request, {});
    
//     // 4. Handle success (Go backend should return a custom app token/session details)
//     console.log("Go backend registered user:", response.toObject());
//     router.push("/dashboard");
//   } catch (err) {
//     setError("Failed to register account with our system.");
//   } finally {
//     setLoading(false);
//   }
// };