import { Link } from "react-router-dom"
import { DashboardContainer } from "../styles/Dashboard.style"

const Dashboard = () => (
    <DashboardContainer>
        <h2>Dashboard goes here</h2>
        <Link to="/">Go to home</Link>
    </DashboardContainer>
)

export default Dashboard