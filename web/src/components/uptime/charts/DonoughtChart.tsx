import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { overallUptimeData } from '@/data/uptime.data';

ChartJS.register(ArcElement, Tooltip, Legend);

const options = {
  responsive: true,
  maintainAspectRatio: false,
//   cutout: 60,
  plugins: {
    legend: {
      display: false
    },
    title: {
      display: false,
    },
  },
};

const data = {
  labels: overallUptimeData.map(el => el.type),
  datasets: [
    {
      label: 'percentage',
      data: overallUptimeData.map(el => el.percent),
      backgroundColor: overallUptimeData.map(el => el.color),
      borderColor: overallUptimeData.map(el => el.color),
      borderWidth: 1,
      width: 100,
    },
  ],
};

const DonoughtChart = () => {
  return <Doughnut data={data} options={options}/>
}

export default DonoughtChart