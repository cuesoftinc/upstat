"use client";

import React, { useState } from "react";
import { Icon } from "@iconify/react";
import Image from "next/image";
import women from "@/assets/images/women.png";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  LoginContainer,
  FormContainer,
  FormHeading,
  FormLabel,
  FormInput,
  GoogleBtnContainer,
  FormWrapper,
} from "./page.styles";

const Login = () => {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleFormSubmit = (ev: any) => {
    ev.preventDefault();

    if (email === "johndoe@gmail.com" && password === "john1234") {
      router.push("/");
      console.log("Login successfully");
      setLoading(true);
      setErrorMsg("");
    } else {
      setErrorMsg("Invalid credentials");
      console.log("Error message");
    }
    console.log(email + " " + password);
    setEmail("");
    setPassword("");
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
              type="text"
              placeholder="•••••••••"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              required
            />
          </FormLabel>
          {errorMsg && <p>{errorMsg}</p>}
          <button>{loading === false ? "Login" : "Loading..."}</button>
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
