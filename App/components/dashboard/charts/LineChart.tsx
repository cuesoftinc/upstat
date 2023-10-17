import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { totalUserData } from '../data';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);


ChartJS.defaults.color = "#fff"

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    title: {
      display: true,
      text: 'Total Users',
      font: {
        size: 16,
      }
    },
  },
  scales: {
    x: {
      ticks: {
        font: {
          size: 16, // Adjust as needed for the X-axis labels
        },
      },
    },
    y: {
      ticks: {
        font: {
          size: 16, // Adjust as needed for the Y-axis labels
        },
      },
    },
  }
};


const data = {
  labels: totalUserData.map(el => el.day),
  datasets: [
    {
      label: 'Current Users',
      data: totalUserData.map(el => el.users),
      borderColor: 'rgba(0, 224, 158, 0.62)',
      backgroundColor: 'rgba(0, 224, 158, 0.62)',
      tension: 0.4,
    },
  ],
};

const LineChart = () => {
  return <Line options={options} data={data} />;
}

export default LineChart