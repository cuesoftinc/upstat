"use client"

import { Icon } from "@iconify/react";
import Image from "next/image";
import women from "@/assets/images/women.png"
import Link from "next/link"
import {
    SignupContainer,
    FormContainer,
    FormHeading,
    FormLabel,
    FormInput,
} from "./page.styles"

const Signup = () => {

    return (
        <SignupContainer>
            <Image src={women} alt="women talking" style={{width: "50%", height: "auto", alignSelf: "end"}} />
            <FormContainer>
                <FormHeading>
                    <h1>Sign Up With Upstat</h1>
                    <p>Have an account? <Link href="/login">Login</Link></p>
                </FormHeading>
                <FormLabel>
                    Full Name
                    <FormInput
                        type="text"
                        placeholder="Input your full name"
                    />
                </FormLabel>
                <FormLabel>
                    Email
                    <FormInput
                        type="text"
                        placeholder="Input your email address"
                    />
                </FormLabel>
                <FormLabel>
                    Password
                    <FormInput
                        type="password"
                        placeholder="•••••••••"
                    />
                </FormLabel>
                <button>Sign Up</button>
                <button>
                    <Icon icon="devicon:google" />
                    <span>Continue with google</span>
                </button>
            </FormContainer>
        </SignupContainer>
    )
}

export default Signup