import { Icon } from "@iconify/react"
import {
    EventsContainer,
    EventsHeading,
    EventDetail,
} from "./Events.styles"

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

export default Events