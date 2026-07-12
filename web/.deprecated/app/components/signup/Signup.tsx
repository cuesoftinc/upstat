"use client";

import { Icon } from "@iconify/react";
import Image from "next/image";
import women from "@/assets/images/women.png";
import Link from "next/link";

import {
  SignupContainer,
  FormContainer,
  FormHeading,
  FormLabel,
  FormInput,
  FormSection,
  GoogleBtn,
} from "./Signup.styles";
import { useState, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Notification from "../otherComponents/helpers/Notification";
import axios from "axios";
//import { useAuth } from "@/contexts/signupContext";
//import { signupAPI } from "@/apis/signup";

// import { userClient } from "@/client";
// import { CreateUserRequest, CreateUserResponse } from "@/proto/user_pb.d";

const SignupPage = () => {
  const router = useRouter();

  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);

  const payload = JSON.stringify({ name, email, password });

  const handleSubmit = async (e: any) => {
    e.preventDefault();

    if (loading) return;
    setLoading(true);

    try {
      const response = await axios.post(
        "http://localhost:5050/api/v1/auth/signup",
        payload
      );

      // Handle the response accordingly
      if (response.status === 201 || response.status === 200) {
        // User signed up successfully
        setLoading(false);
        console.log("User signed up successfully");
        setSuccess("User signed up successfully");

        router.push("/login");
      }
    } catch (error) {
      console.error("user with this email already exist", error);
      setError("user with this email already exist");
      setLoading(false);
    }
  };

  return (
    <SignupContainer>
      <Image
        src={women}
        alt="women talking"
        style={{ width: "50%", height: "auto", alignSelf: "end" }}
      />
      <FormSection>
        <FormHeading>
          <h1>Sign Up With Upstat</h1>
          <p>
            Have an account? <Link href="/login">Login</Link>
          </p>
          {error !== "" && <Notification type="error" msg={error} />}
          {success !== "" && <Notification type="success" msg={success} />}
        </FormHeading>
        <FormContainer onSubmit={handleSubmit}>
          <FormLabel>
            Full Name
            <FormInput
              type="text"
              name="name"
              onChange={(ev) => setName(ev.target.value)}
              value={name}
              placeholder="Input your full name"
              required
            />
          </FormLabel>
          <FormLabel>
            Email
            <FormInput
              type="email"
              name="email"
              onChange={(ev) => setEmail(ev.target.value)}
              value={email}
              placeholder="Input your email address"
              required
            />
          </FormLabel>
          <FormLabel>
            Password
            <FormInput
              type="password"
              name="password"
              onChange={(ev) => setPassword(ev.target.value)}
              value={password}
              placeholder="•••••••••"
              required
            />
          </FormLabel>
          <button>{loading ? "loading..." : "Sign up"}</button>
        </FormContainer>

        <GoogleBtn>
          <Icon icon="devicon:google" />
          <span>Continue with google</span>
        </GoogleBtn>
      </FormSection>
    </SignupContainer>
  );
};

export default SignupPage;
