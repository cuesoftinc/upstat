import { Icon } from "@iconify/react"
import { styled } from "styled-components"

const eventData: {
    event: string,
    time: string,
}[] = [
    {
        event: "Down for 2 minutes",
        time: (new Date()).toString()
    },
    {
        event: "Monitoring was paused",
        time: (new Date()).toString()
    },
]

const Events = () => {

    const eventsTsx = eventData.map((el, i) => (
        <EventDetail>
            <p>{el.event}</p>
            <span>{el.time}</span>
        </EventDetail>
    ))

    return (
        <EventsContainer>
            <EventsHeading>
                <span>Recent Events</span>
                <Icon icon="bi:three-dots-vertical" />
            </EventsHeading>
            {eventsTsx}
        </EventsContainer>
    )
}

const EventsContainer = styled.section`
    width: 100%;
    background: #3C3C3C;
    border-radius: 10px;
    padding: 15px 22px 25px 14px;
    color: #fff;
`

const EventsHeading = styled.div`
    display: flex;
    padding-bottom: 17px;
    font-size: 20px;
    justify-content: space-between;
`

const EventDetail = styled.div`
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 15px 0 11px;
    border-top: 0.5px solid rgba(255, 255, 255, 0.50);

    span {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.50);
        font-weight: 500;
    }
`

export default Events