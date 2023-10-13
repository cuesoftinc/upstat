"use client"

import { Icon } from "@iconify/react";
import Image from "next/image";
import women from "@/assets/images/women.png";
import Link from "next/link";


import {
    LoginContainer,
    FormContainer,
    FormHeading,
    FormLabel,
    FormInput,
} from "./page.styles"

const Login = () => {

    return (
        <LoginContainer>
            <Image src={women} alt="women talking" style={{width: "50%", height: "auto", alignSelf: "end"}} />
            <FormContainer>
                <FormHeading>
                    <h1>Welcome Back!</h1>
                    <p>Don't have an account? <Link href="/signup">Sign up</Link></p>
                </FormHeading>
                <FormLabel>
                    Email
                    <FormInput
                    type="text"
                    />
                </FormLabel>
                <FormLabel>
                    Password
                    <FormInput
                    type="text"
                    />
                </FormLabel>
                <button>Login</button>
                <p>Forgot Password?</p>
                <button>
                    <Icon icon="devicon:google" />
                    <span>Continue with google</span>
                </button>
            </FormContainer>
        </LoginContainer>
    )
}

export default Login