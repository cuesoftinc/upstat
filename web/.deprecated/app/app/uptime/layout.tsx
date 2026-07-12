import Header from "@/components/SharedLayouts/Header/Header"


const UptimeLayout = ({
    children,
  }: {
    children: React.ReactNode;
  }) => {
    return (
      <>
        <Header />
        {children}
      </>
    )
  }
  
export default UptimeLayout