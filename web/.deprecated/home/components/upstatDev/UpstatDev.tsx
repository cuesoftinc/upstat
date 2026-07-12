import React from "react";
import {
  DevContainer,
  DevWrapper,
  InfoWrapper,
  Card,
} from "./UpstatDev.styles";
import CodingView from "../codingView/CodingView";
import { Icon } from "@iconify/react";
import aws from "../../assets/awsImage.png";
import upstatMobile from "../../assets/upstat_mobile_view.png";
import upstatDesktop from "../../assets/upstat_desktop_view.png";
import Image from "next/image";
import ibukunDairo from "../../assets/ibukun-dairo.jpg";

const UpstatDev = () => {
  return (
    <DevWrapper>
      <DevContainer>
        <h1>
          Upstat for <span>developer</span>
        </h1>
        <p>Build, maintain, and deploy internal tools 10X faster.</p>
      </DevContainer>
      <div>
        <CodingView
          icon={<Icon icon="icon-park-outline:connection-box" />}
          iconText="Data"
          header="Import data from any data source."
          info="Connect to any database, SaaS tool, or GraphQL/REST API within a few clicks. Query your data directly using SQL or our query builder"
          btnText="12+ native integrations"
          image={aws}
          imageAlt="aws"
        />
        <CodingView
          icon={<Icon icon="heroicons-outline:template" />}
          iconText="App UI"
          header="Construct the user interface by dragging and dropping widgets."
          info=" Leverage over 30+ customizable widgets to craft a stunning, responsive UI within minutes, all without the need to write a single line of HTML/CSS."
          btnText="Start building with 30+ widgets"
          image={upstatMobile}
          imageAlt="upstate"
        />

        <CodingView
          icon={<Icon icon="tabler:code" />}
          iconText="Code"
          header="Personalize and develop through coding."
          info=" Compose in-line JavaScript or employ reusable code blocks to expand your app's functionality, tailor your UI, or implement conditional logic."
          btnText="Write Javascript in Upstat"
          image={upstatDesktop}
          imageAlt="UpstatDesktop"
        />
      </div>
      <InfoWrapper>
        <p className="info">
          “After experimenting with various low-code solutions, Upstat emerged
          as the clear winner for our specific use case. The remarkable speed at
          which you can assemble an internal tool is unparalleled. We seamlessly
          integrated it with our data warehouse, Microsoft Teams, and our
          logging, monitoring, and metrics infrastructure."
        </p>

        <Card>
          <Image
            src={ibukunDairo}
            alt="CEO"
            height={50}
            width={50}
            className="image"
          />
          <div className="card_info">
            <h3>Ibukun Dairo</h3>
            <p>CEO, Cuesoft</p>
          </div>
        </Card>
      </InfoWrapper>
    </DevWrapper>
  );
};

export default UpstatDev;
