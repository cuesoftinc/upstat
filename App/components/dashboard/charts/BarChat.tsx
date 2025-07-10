import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { deviceTrafficData } from '@/data/dashboard.data';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
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
      text: 'Traffic By Device',
      font: {
        size: 16,
      }
    },
  },
  scales: {
    x: {
      ticks: {
        font: {
          size: 16, 
        },
      },
    },
    y: {
      ticks: {
        font: {
          size: 16, 
        },
      },
    },
  }
};


const data = {
  labels: deviceTrafficData.map(el => el.device),
  datasets: [
    {
      data: deviceTrafficData.map(el => el.traffic),
      borderColor: 'rgba(0, 224, 158, 0.62)',
      backgroundColor: 'rgba(0, 224, 158, 0.62)',
      borderRadius: 10,
      barThickness: 27, 
    },
  ],
};

const BarChart = () => {
  return <Bar options={options} data={data} />;
}


export default BarChart;
