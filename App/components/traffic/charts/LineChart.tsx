import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { totalViewData } from "@/utils/trafficData";

ChartJS.register(
  Title,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement
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
        min: 0,
        max: Math.max(...totalViewData.map((el) => el.value)),
      },
    },
  },
};

const data = {
  labels: totalViewData.map((el) => el.month),
  datasets: [
    {
      label: "",
      data: totalViewData.map((el) => el.value),
      borderColor: "rgba(0, 224, 158, 0.62)",
      backgroundColor: "rgba(0, 224, 158, 0.62)",
      tension: 0.1,
    },
  ],
};

const LineChart = () => {
  return <Line options={options} data={data} />;
};

export default LineChart;
