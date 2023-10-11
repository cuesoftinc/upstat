import { styled } from "styled-components"

const HeaderContainer = styled.div`
    width: 100%;
    display: flex;
    padding: 25px 43px;
    gap: 29px;
`

const SearchBarContianer = styled.div`
    width: 60%;
    display: flex;
    padding: 5px 14px;
    justify-content: space-between;
    align-items: center;
    border-radius: 10px;
    border: 0.5px solid var(--font, #3C3C3C);
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
    align-item: center;
`

const Input = styled.input`
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
    color: rgba(60, 60, 60, 0.50);
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