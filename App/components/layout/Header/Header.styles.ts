import { styled } from "styled-components"

const HeaderContainer = styled.div`
    width: 100%;
    display: flex;
    padding: 43px 62px 24px 21px;
    justify-content: space-between;
    border-bottom: 2px #3c3c3c solid;
    gap: 29px;
    background: #16151C;
    color: #fff;

    svg {
        opacity: 0.51
    }
`

const SearchBarContianer = styled.div`
    width: 60%;
    display: flex;
    padding: 13px 14px;
    justify-content: space-between;
    align-items: center;
    border-radius: 10px;
    border: 0.5px solid rgba(255, 255, 255, 0.50);
`

const IconContainer = styled.div`
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 5px 24px;
    border-left: 2px #3c3c3c solid;
    border-right: 2px #3c3c3c solid;
`

const ProfileContainer = styled.div`
    display: flex;
    gap: 16px;
    align-items: center;
`

const Input = styled.input`
    background: transparent;
    border: none;
    min-width: 90%;
    outline: none;

    &:focus {
        outline: none;
    }
`

const DetailsContainer = styled.div`
    
`

const Position = styled.p`
    color: rgba(255, 255, 255, 0.50);
    margin-top: 5px;
`

export {
    SearchBarContianer, 
    DetailsContainer, 
    ProfileContainer, 
    HeaderContainer, 
    IconContainer, 
    Position, 
    Input
}