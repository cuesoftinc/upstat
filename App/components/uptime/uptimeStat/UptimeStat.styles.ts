import { styled } from "styled-components"

const UptimeStatContainer = styled.section`
    background: #3C3C3C;
    border-radius: 10px;
    width: 100%;
    color: white;
    padding: 3px 18px 17px 17px;
`

const UptimeStatHeading = styled.div`
    display: flex;
    padding: 17px 0;
    justify-content: space-between;
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.50);

    div {
        display: flex;
    }

    .left-heading {
        gap: 21px;
        font-size: 20px;
    }

    .right-heading {
        align-items: end;
        gap: 48px;
        
        p {
            font-weight: 600;
            cursor: pointer;
            &:hover {
                text-decoration: underline;
            }
        }
    }
`

const StatusHeading = styled.div`
    display: flex;
    gap: 270px;
    padding: 15px 0;
    
    border-bottom: 0.5px solid rgba(255, 255, 255, 0.50);
`

export {
    UptimeStatContainer,
    UptimeStatHeading,
    StatusHeading
}