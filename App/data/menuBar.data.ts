import { accountDataTypes, menudataTypes } from "@/types/menuBar.types"

export const menudata: menudataTypes = [
    {
        id: 0,
        icon: "material-symbols:dashboard",
        name: "Dashboard",
        path:"/"
    },
    {
        id: 1,
        icon: "ph:traffic-sign-fill",
        name: "Traffic",
        path:"/traffic"
    },
    {
        id: 2,
        icon: "bxs:hourglass",
        name: "Uptime",
        path:"/uptime"
    },

    {
        id: 3,
        icon: "mingcute:time-fill",
        name: "Page Load Time",
        path:"/pageloadtime"
    },
    {
        id: 4,
        icon: "mdi:analytics",
        name: "SEO Metrics",
        path:"/seo"
    },
    {
        id: 5,
        icon: "fluent:arrow-bounce-16-filled",
        name: "Bounce Rate",
        path:"/bounce"
    },
    {
        id: 6,
        icon: "material-symbols:error",
        name: "Error Rate",
        path:"/error"
    }
]

export const accountData: accountDataTypes = [
    {
        id: 1,
        icon: "icon-park-solid:setting",
        name: "Settings",
        path:"/settings"
    },
    {
        id: 2,
        icon: "mdi:help-box",
        name: "Help Center",
        path:"/help"
    },
]