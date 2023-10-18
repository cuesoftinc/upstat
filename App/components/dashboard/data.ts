export const totalUserData: {
  id: number,
  day: string,
  users: number | null
}[] = [
    {
      id: 0,
      day: "",
      users: null
    },
    {
      id: 1,
      day: "Mon",
      users: 1000000,
    },
    {
      id: 2,
      day: "Tue",
      users: 5000000,
    },
    {
      id: 3,
      day: "Wed",
      users: 7500000,
    },
    {
      id: 4,
      day: "Thur",
      users: 10000000,
    },
    {
      id: 5,
      day: "Fri",
      users: 12200000,
    },
    {
      id: 6,
      day: "Sat",
      users: 16000000,
    },
    {
      id: 5,
      day: "Sun",
      users: null
    },
  ];
  

  export const webTrafficData: {
    id: number,
    name: string,
    range: number,
  }[] = [
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

  export const deviceTrafficData: {
    id: number,
    device: string,
    traffic: number | null
  }[] = [
    {
      id: 0,
      device: "Macbook",
      traffic: 230000,
    },
    {
      id: 1,
      device: "IOS",
      traffic: 270000,
    },
    {
      id: 2,
      device: "Windows",
      traffic: 300000,
    },
    {
      id: 3,
      device: "Andriod",
      traffic: 360000,
    },
    {
      id: 4,
      device: "Others",
      traffic: 270000,
    },
  ]

  export const locationTrafficData: {
    id: number,
    name: string,
    percent: number,
    color: string,
  }[] = [
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