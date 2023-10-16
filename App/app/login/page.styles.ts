import { styled } from "styled-components"


const LoginContainer = styled.section`
    display: flex;
    align-items: start;
    padding: 72px 62px 112px 0;
    height: 100%;
    font-size: 24px;
    background: #16151C;
    color: #fff
`

const FormHeading = styled.div`
    text-align: center;
    
    p {
        margin-top: 20px;
    }

    a {
        color: #fff;
        opacity: 0.7;

        &:hover {
            text-decoration: underline;
        }
    }
`

const FormContainer = styled.form`
    width: 50%;
    display: flex;
    flex-direction: column;
    gap: 32px;
    padding: 0 0 50px;
    
    button {
        padding: 20px;
        font-size: 24px;
        border: none;
        border-radius: 5px;
        background: #fff;
    }

    button:nth-of-type(2n) {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 21px;
        background: transparent;
        color: #fff;
        border: 1px solid #FFF;
    }
`

const FormLabel = styled.label`
    display: flex;
    flex-direction: column;
    gap: 10px;
`

const FormInput = styled.input`
    width: 100%;
    padding: 20px;
    border-radius: 5px;
    font-size: 24px;
    background: transparent;
    border: 1px solid #fff;
    color: white;
    
    &:focus {outline: none}
`
export {
    LoginContainer,
    FormContainer,
    FormHeading,
    FormLabel,
    FormInput,
}