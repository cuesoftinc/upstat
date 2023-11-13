import Header from "@/components/SharedLayouts/Header/Header"
import ChartSection from "@/components/uptime/chartSection/ChartSection"
import TopSection from "@/components/uptime/topSection/TopSection"
import UptimeStat from "@/components/uptime/uptimeStat/UptimeStat"


const Uptime = () => {
    return (
      <>
        <Header />
        <TopSection system="All system" back={false}/>
        <UptimeStat />
        <ChartSection />
      </>
    )
  }
  
export default Uptime