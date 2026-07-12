"use client"

import { Icon } from "@iconify/react";
import Image from "next/image";
import women from "@/assets/women.png"
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
import { useState } from "react";
// import { userClient } from "@/client";
// import { CreateUserRequest, CreateUserResponse } from "@/proto/user_pb.d";


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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
    //     console.log(formData)

    //     const user = new CreateUserRequest()

        // user.setName(formData.fullName)
        // user.setEmail(formData.email)
        // user.setPassword(formData.password)

        // try {
            // const res: CreateUserResponse = await userClient.createUser(user, null)
            
            // if (res.getStatus() === "success") {
            //     setSucces(res.getData())
            // } else {
            //     setError(res.getData())
            // }
            
        // } catch(err: any) {
        //     setError(err)
        // } finally {
        //     // Reset form
        //     setFormData(defaultFormData)
        // }

        // Alert user on sign up
        // ssetTimeou/(alert("You have sucessfully signed up to upstat"))
    }

    // console.log(sucess, error,)

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