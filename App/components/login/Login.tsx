"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";
import Image from "next/image";
import women from "@/assets/images/women.png";
import Link from "next/link";
import { useRouter } from "next/navigation";
import axios from "axios";
import {
  LoginContainer,
  FormContainer,
  FormHeading,
  FormLabel,
  FormInput,
  GoogleBtnContainer,
  FormWrapper,
} from "./Login.styles";
import Notification from "../otherComponents/helpers/Notification";

const Login = () => {
  const router = useRouter();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (loading) return;
    setLoading(true);

    try {
      // Send a POST request to the login endpoint with user credentials
      const response = await axios.post(
        "http://localhost:5050/api/v1/auth/signin",
        {
          email,
          password,
        }
      );

      if (response.status === 200) {
        setLoading(false);
        setSuccess("Login Successfully");
        // Store the token
        console.log(response.data.data);
        localStorage.setItem("token", response.data.token);
        localStorage.setItem("user", JSON.stringify(response.data.data));

        router.push("/");
      }
    } catch (error) {
      console.error("An error occurred during login:", error);
      setError("Invalid credential");
      setLoading(false);
    }
  };
  return (
    <LoginContainer>
      <Image
        src={women}
        alt="women talking"
        style={{ width: "50%", height: "auto", alignSelf: "end" }}
      />
      <FormWrapper>
        <FormContainer onSubmit={handleFormSubmit}>
          <FormHeading>
            <h1>Welcome Back!</h1>
            <p>
              Don&apos;t have an account? <Link href="/signup">Sign up</Link>
            </p>
            {error !== "" && <Notification type="error" msg={error} />}
            {success !== "" && <Notification type="success" msg={success} />}
          </FormHeading>
          <FormLabel>
            Email
            <FormInput
              type="text"
              placeholder="Input your email address"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              required
            />
          </FormLabel>
          <FormLabel>
            Password
            <FormInput
              type="password"
              placeholder="•••••••••"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              required
            />
          </FormLabel>

          <button>{loading ? "loading..." : "Login"}</button>
          <p>Forgot Password?</p>
        </FormContainer>
        <GoogleBtnContainer>
          <button>
            <Icon icon="devicon:google" />
            <span>Continue with google</span>
          </button>
        </GoogleBtnContainer>
      </FormWrapper>
    </LoginContainer>
  );
};

export default Login;
