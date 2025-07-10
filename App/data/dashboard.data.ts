import { deviceTrafficDataType, locationTrafficDataType, statsDataType, totalUserDataType, webTrafficDataType } from "@/types/dashboard.types";

const downChart = "streamline:money-graph-arrow-decrease-down-stats-graph-descend-right-arrow"
const upChart = "streamline:money-graph-arrow-increase-ascend-growth-up-arrow-stats-graph-right-grow"

export const statsData: statsDataType = [
    {
        id: 0,
        name: "Web Views",
        number: "658k",
        percent: "+3.08",
        chart: upChart,
        color: "#00E09E"
    },
    {
        id: 1,
        name: "Unique Visitors",
        number: "246k",
        percent: "-8.36",
        chart: downChart,
        color: "#FF3D5A"
    },
    {
        id: 2,
        name: "New Users",
        number: "1352",
        percent: "+2.65",
        chart: upChart,
        color: "#00E09E"
    },
    {
        id: 3,
        name: "Page VIew",
        number: "438",
        percent: "-0.37",
        chart: downChart,
        color: "#FF3D5A"
    },
    {
        id: 0,
        name: "Active Users",
        number: "294k",
        percent: "-5.12",
        chart: downChart,
        color: "#FF3D5A"
    },
]

export const totalUserData: totalUserDataType = [
    {
      id: 0,
      day: "",
      users: null
    },
    {
      id: 1,
      day: "Mon",
      users: 1000,
    },
    {
      id: 2,
      day: "Tue",
      users: 5000,
    },
    {
      id: 3,
      day: "Wed",
      users: 7500,
    },
    {
      id: 4,
      day: "Thur",
      users: 10000,
    },
    {
      id: 5,
      day: "Fri",
      users: 12200,
    },
    {
      id: 6,
      day: "Sat",
      users: 16000,
    },
    {
      id: 5,
      day: "Sun",
      users: null
    },
  ];
  

  export const webTrafficData:  webTrafficDataType = [
    {
      id: 0,
      name: "Google",
      range: 100,
    },
    {
      id: 1,
      name: "Youtube",
      range: 20,
    },
    {
      id: 2,
      name: "Twitter",
      range: 50,
    },
    {
      id: 3,
      name: "Instagram",
      range: 10,
    },
    {
      id: 4,
      name: "Facebook",
      range: 80,
    },
    {
      id: 5,
      name: "Dribble",
      range: 70,
    },
    {
      id: 6,
      name: "Behance",
      range: 40,
    },
    {
      id: 7,
      name: "Gmail",
      range: 30,
    },
    {
      id: 8,
      name: "Messenger",
      range: 70,
    },
  ]

  export const deviceTrafficData: deviceTrafficDataType = [
    {
      id: 0,
      device: "Macbook",
      traffic: 230,
    },
    {
      id: 1,
      device: "IOS",
      traffic: 270,
    },
    {
      id: 2,
      device: "Windows",
      traffic: 300,
    },
    {
      id: 3,
      device: "Andriod",
      traffic: 360,
    },
    {
      id: 4,
      device: "Others",
      traffic: 270,
    },
  ]

  export const locationTrafficData: locationTrafficDataType = [
    {
      id: 0,
      name: 'London',
      percent: 32.1,
      color: '#fff',
    },
    {
      id: 1,
      name: 'India',
      percent: 21.6,
      color: '#ffc3cc',
    },
    {
      id: 2,
      name: 'Nigeria',
      percent: 26.2,
      color: '#17A279',
    }, 
    {
      id: 3,
      name: 'Others',
      percent: 20.1,
      color: '#560808'
    }
  ]