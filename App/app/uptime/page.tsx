import Header from "@/components/SharedLayouts/Header/Header"
import TopSection from "@/components/uptime/topSection/TopSection"
import UptimeStat from "@/components/uptime/uptimeStat/UptimeStat"


const Uptime = () => {
    return (
      <>
        <Header />
        <TopSection system="All system" back={false}/>
        <UptimeStat />
      </>
    )
  }
  
export default Uptime