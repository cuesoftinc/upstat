import Header from "@/components/shared-layouts/header/Header"


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