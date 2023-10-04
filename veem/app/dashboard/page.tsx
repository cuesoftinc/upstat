"use client"

import { DashboardContainer } from "./dashboard.style"
import Link from 'next/link'

 const DashBoard: React.FC = () => {

  return (
    <DashboardContainer>
      <h2>Home goes here</h2>
      <Link href="/">Go to home</Link>
    </DashboardContainer>
  )
}

export default DashBoard