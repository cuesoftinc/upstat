"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { UserServiceClient } from "@/components/libs/grpc/user-auth-client";
import { GoogleAuthRequest } from "@/components/libs/grpc/user-auth-pb";

if (typeof window !== "undefined" && !(window as any).proto) {
  (window as any).proto = { jspb: require("google-protobuf") };
}
// gRPC-Web endpoint (Envoy) — local compose publishes it on :8082.
const ENVOY_URL = process.env.NEXT_PUBLIC_ENVOY_URL || "http://localhost:8082";
const grpcClient = new UserServiceClient(ENVOY_URL);

export function useGoogleAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleBackendAuthentication = async (credentialResponse: { credential?: string }) => {
    try {
      setIsLoading(true);
      setError("");

      const idToken = credentialResponse.credential;

      if (!idToken) {
        throw new Error("Failed to extract ID token from Google authorization response.");
      }

      const request = new GoogleAuthRequest();
      request.setIdToken(idToken);

      const response = await grpcClient.googleAuth(request, {});
      const data = response.toObject();

      Cookies.set("upstat_token", data.token, {
        secure: true,
        sameSite: "strict",
        expires: 7,
      });
      Cookies.set(
        "upstat_user",
        JSON.stringify({ name: data.name, email: data.email }),
        { secure: true, sameSite: "strict", expires: 7 }
      );

      setIsLoading(false);
      router.push("/dashboard");
    } catch (err: any) {
      setIsLoading(false);
      console.error("gRPC Authentication Error:", err);
      setError(err.message || "An unexpected error occurred during profile verification.");
    }
  };

  const handleAuthError = () => {
    setError("Google authorization popup closed or rejected.");
  };

  return { handleBackendAuthentication, handleAuthError, isLoading, error };
}