import { accountDataTypes, menudataTypes } from "@/components/types/menu-bar.types"

export const menudata: menudataTypes = [
    {
        id: 0,
        icon: "material-symbols:dashboard",
        name: "Dashboard",
        path:"/dashboard"
    },
    {
        id: 1,
        icon: "ph:traffic-sign-fill",
        name: "Traffic",
        path:"/dashboard/traffic"
    },
    {
        id: 2,
        icon: "bxs:hourglass",
        name: "Uptime",
        path:"/dashboard/uptime"
    },

    {
        id: 3,
        icon: "mingcute:time-fill",
        name: "Page Load Time",
        path:"/dashboard/pageloadtime"
    },
    {
        id: 4,
        icon: "mdi:analytics",
        name: "SEO Metrics",
        path:"/dashboard/seo"
    },
    {
        id: 5,
        icon: "fluent:arrow-bounce-16-filled",
        name: "Bounce Rate",
        path:"/dashboard/bounce"
    },
    {
        id: 6,
        icon: "material-symbols:error",
        name: "Error Rate",
        path:"/dashboard/error"
    }
]

export const accountData: accountDataTypes = [
    {
        id: 1,
        icon: "icon-park-solid:setting",
        name: "Settings",
        path:"/dashboard/settings"
    },
    {
        id: 2,
        icon: "mdi:help-box",
        name: "Help Center",
        path:"/dashboard/help"
    },
]