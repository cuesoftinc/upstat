import { Link } from "react-router-dom"
import { HomeContainer } from "../styles/Home.style"

const Home = () => (
    <HomeContainer>
        <h2>Home goes here</h2>
        <Link to="dashboard">Go to dashboard</Link>
    </HomeContainer>
)

export default Home