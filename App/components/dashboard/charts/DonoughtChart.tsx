import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { locationTrafficData } from '../data';

ChartJS.register(ArcElement, Tooltip, Legend);

const options = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: 60,
  plugins: {
    legend: {
      display: false
    },
    title: {
      display: true,
      text: 'Traffic By Location',
    },
  },
};

const data = {
  labels: locationTrafficData.map(el => el.name),
  datasets: [
    {
      label: 'location',
      data: locationTrafficData.map(el => el.percent),
      backgroundColor: locationTrafficData.map(el => el.color),
      borderColor: locationTrafficData.map(el => el.color),
      borderWidth: 1,
    },
  ],
};

const DonoughtChart = () => {
  return <Doughnut data={data} options={options}/>
}

export default DonoughtChart