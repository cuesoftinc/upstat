import Image from "next/image";
import Navbar from "@/components/layout/nav-bar/NavBar";
import Hero from "@/components/pages/home/hero/Hero";
import Customers from "@/components/pages/home/customers/Customers";
import Team from "@/components/pages/home/team/Team";
import Developer from "@/components/pages/home/developer/Developer";
import Workflow from "@/components/pages/home/workflow/Workflow";
import BusinessNeeds from "@/components/pages/home/business-needs/BusinessNeeds";
import Community from "@/components/pages/home/community/Community";
import Footer from "@/components/pages/home/footer/Footer";

export default function Home() {
  return (
    <div>
      <Navbar />
      <Hero />
      <Customers />
      <Team />
      <Developer />
      <Workflow />
      <BusinessNeeds />
      <Community />
      <Footer />
    </div>
  );
}


  