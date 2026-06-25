"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGoogleLogin } from "@react-oauth/google";
import { UserServiceClient } from "../../components/proto/UserServiceClient";
import { GoogleAuthRequest } from "../../components/proto/user_pb";

const ENVOY_URL = process.env.NEXT_PUBLIC_ENVOY_URL;

if (!ENVOY_URL) {
  throw new Error("Missing environmental variable: NEXT_PUBLIC_ENVOY_URL is not defined.");
}

const grpcClient = new UserServiceClient(ENVOY_URL);

export function useGoogleAuth() {
  const [error, setError] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const router = useRouter();

  const handleBackendAuthentication = async (idToken: string) => {
    try {
      const request = new GoogleAuthRequest();
      request.setIdToken(idToken);

      const response = await grpcClient.googleAuth(request);
      const userData = response.toObject();

      localStorage.setItem("upstat_token", userData.token);
      
      router.push("/dashboard");
    } catch (err: any) {
      console.error("gRPC Authentication Error:", err);
      setError(err?.message || "Failed to connect with Upstat servers.");
      setIsLoading(false);
    }
  };

  const triggerLogin = useGoogleLogin({
    onSuccess: (tokenResponse) => handleBackendAuthentication(tokenResponse.access_token),
    onError: () => {
      setError("Google authentication failed.");
      setIsLoading(false);
    },
  });

  const handleAuthSubmit = () => {
    if (isLoading) return;
    setIsLoading(true);
    setError("");
    triggerLogin();
  };

  return {
    handleAuthSubmit,
    isLoading,
    error,
  };
}