import { overallUptimeDataType, responseTimeDataType, systemDataType } from "@/types/uptime.types";

export const systemData: systemDataType = [
    {
        name: "API",
        percent: 98,
        status: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,1,]
    },
    {
        name: "Website",
        percent: 93,
        status: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,1,]
    },
    {
        name: "Server",
        percent: 91,
        status: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,1,1,0,1,1,1,1,1,1,0,1,0,0,1,0,0]
    },
    {
        name: "Blog",
        percent: 32,
        status: [1,0,1,0,1,0,1,1,1,1,0,0,0,0,0,0,1,1,0,0,0,1,0,1,0,1,1,1,1,0,0,0,1,0,0,0,0,1,0,0,1,0,0]
    },
]

export const responseTimeData: responseTimeDataType = [
    {
        type: "Avg",
        figure: 159.26
    },
    {
        type: "Max",
        figure: 462.63
    },
    {
        type: "Min",
        figure: 125.84
    },
]

export const overallUptimeData: overallUptimeDataType = [
    {
      id: 0,
      type: '24hrs',
      percent: 98,
      color: '#fff',
    },
    {
      id: 1,
      type: '7 days',
      percent: 99,
      color: '#E63751',
    }, 
    {
      id: 3,
      type: '120 days',
      percent: 93,
      color: '#EFFF31'
    },
    {
      id: 2,
      type: '30 days',
      percent: 99,
      color: '#7DE46C',
    },
  ]