import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { dailyVisitorData } from "@/utils/trafficData";

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement
);

ChartJS.defaults.color = "#fff";

const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false,
    },
    title: {
      display: false,

      font: {
        size: 16,
      },
    },
  },
  scales: {
    x: {
      ticks: {
        font: {
          size: 14,
        },
      },
    },
    y: {
      ticks: {
        font: {
          size: 14,
        },
      },
    },
  },
};

const data = {
  labels: dailyVisitorData.map((el) => el.visitor),
  datasets: [
    {
      data: dailyVisitorData.map((el) => el.value),
      borderColor: "rgba(0, 224, 158, 0.62)",
      backgroundColor: "rgba(0, 224, 158, 0.62)",
      borderRadius: 10,
      barThickness: 5,
    },
  ],
};

const BarChart = () => {
  return <Bar options={options} data={data} />;
};

export default BarChart;
