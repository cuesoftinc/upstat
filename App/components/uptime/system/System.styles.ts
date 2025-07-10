import { styled } from "styled-components"

const SystemContainer = styled.div`
    display: flex;
    gap: 70px;
    padding: 17px 0 11px;
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.50);
    font-size: 20px;
`

const NameAndPercent = styled.div`
    min-width: 380px;
    display: flex;
    justify-content: space-between;
`

const Name = styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
    margin-right: 200px;

    a:hover {
        text-decoration: underline;
    }
`

export {
    SystemContainer,
    NameAndPercent,
    Name
}