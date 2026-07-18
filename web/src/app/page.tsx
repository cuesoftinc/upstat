"use client";

import { useRouter } from "next/navigation";
import { MarketingNav } from "@/components/ui/MarketingNav";
import Hero from "@/components/pages/home/hero/Hero";
import Customers from "@/components/pages/home/customers/Customers";
import Team from "@/components/pages/home/team/Team";
import Developer from "@/components/pages/home/developer/Developer";
import Workflow from "@/components/pages/home/workflow/Workflow";
import BusinessNeeds from "@/components/pages/home/business-needs/BusinessNeeds";
import Community from "@/components/pages/home/community/Community";
import Footer from "@/components/pages/home/footer/Footer";

/**
 * / — public home. The nav is the W1 MarketingNav (the legacy NavBar is
 * quarantined in src/legacy — it linked the retired /login route); the
 * remaining sections are the live legacy home until W2 rebuilds Part A.
 */
export default function Home() {
  const router = useRouter();
  return (
    <div>
      <MarketingNav
        onSignIn={() => router.push("/signin")}
        onTryCloud={() => router.push("/signin")}
      />
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
