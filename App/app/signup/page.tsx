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
    FormSection,
    GoogleBtn,
} from "./page.styles"
import { use, useState } from "react";

const Signup = () => {

    const defaultFormData: {
        fullName: string,
        email: string,
        password: string,
    } = {
        fullName: "",
        email: "",
        password: ""
    }

    const [formData, setFormData] = useState(defaultFormData)
    const [sucess, setSucces] = useState<string>("")
    const [error, setError] = useState<string>("")

    const handleChange = (e: any) => {
        const {name, value} = e.target
        setFormData(prev => ({
            ...prev,
            [name] : value
        }))
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        console.log(formData)

        // Reset form
        setFormData(defaultFormData)

        // Alert user on sign up
        alert("You have sucessfully signed up to upstat")
    }

    return (
        <SignupContainer>
            <Image src={women} alt="women talking" style={{width: "50%", height: "auto", alignSelf: "end"}} />
            <FormSection>
                <FormHeading>
                    <h1>Sign Up With Upstat</h1>
                    <p>Have an account? <Link href="/login">Login</Link></p>
                </FormHeading>
                <FormContainer onSubmit={handleSubmit}>
                    <FormLabel>
                        Full Name
                        <FormInput
                            type="text"
                            name="fullName"
                            onChange={handleChange}
                            value={formData.fullName}
                            placeholder="Input your full name"
                            required
                        />
                    </FormLabel>
                    <FormLabel>
                        Email
                        <FormInput
                            type="email"
                            name="email"
                            onChange={handleChange}
                            value={formData.email}
                            placeholder="Input your email address"
                            required
                        />
                    </FormLabel>
                    <FormLabel>
                        Password
                        <FormInput
                            type="password"
                            name="password"
                            onChange={handleChange}
                            value={formData.password}
                            placeholder="•••••••••"
                            required
                        />
                    </FormLabel>
                    <button>Sign Up</button>
                </FormContainer>
                <GoogleBtn>
                    <Icon icon="devicon:google" />
                    <span>Continue with google</span>
                </GoogleBtn>
            </FormSection>
        </SignupContainer>
    )
}

export default Signup