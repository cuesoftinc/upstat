import React, { useRef, useState } from "react";
import {
  AccountInfoSection,
  InputBox,
  InputBtnGroup,
  InputGroup,
  ProfileButton,
  ProfileContainer,
} from "./AccountInfo.styles";
import profile from "../../../assets/images/profile.png";
import Image from "next/image";
import { Icon } from "@iconify/react";

const AccountInfo = () => {
  //functionality to upload image files
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const handleButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];

      if (selectedFile.type.startsWith("image/")) {
        const imageUrl = URL.createObjectURL(selectedFile);
        setSelectedImage(imageUrl);
      } else {
        alert("Please select an image file.");
      }
    }
  };
  return (
    <AccountInfoSection>
      <ProfileContainer>
        {selectedImage ? (
          <Image
            src={selectedImage}
            alt="profile"
            width={90}
            height={90}
            className="image"
          />
        ) : (
          <Image src={profile} alt="profile" width={60} />
        )}
        <div>
          <p>Wasiu Abdulsalam</p>
          <span>Office Manager</span>
        </div>
        <ProfileButton onClick={handleButtonClick}>
          Upload New{" "}
          <span>
            <Icon icon="ph:plus-circle-bold" />
          </span>
        </ProfileButton>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: "none" }}
          multiple={false}
          onChange={handleFileSelect}
        />
      </ProfileContainer>

      <InputGroup>
        <InputBox>
          <label htmlFor="fullName">Full Name</label>
          <input type="text" name="fullName" placeholder="Input your name" />
        </InputBox>

        <InputBox>
          <label htmlFor="phone">Phone</label>
          <input type="tel" name="phone" placeholder="+234 855 8584 984" />
        </InputBox>

        <InputBox>
          <label htmlFor="email">Email</label>
          <input
            type="email"
            name="email"
            placeholder="wasiu.abdulsalam@cuesoft.io"
          />
        </InputBox>
        <InputBox>
          <label htmlFor="country">Country</label>
          <select name="country" id="country">
            <option value="" disabled selected>
              Nigeria
            </option>
            <option value=""> Nigeria</option>
          </select>
        </InputBox>
        <InputBox>
          <label htmlFor="timeZone">Time Zone</label>
          <select name="" id="">
            <option value="" disabled>
              {" "}
              ( UTC + 04:00) Europe/Egypt
            </option>
            <option value=""> GMT+1</option>
          </select>
        </InputBox>

        <InputBtnGroup>
          <button
            className="cancelBtn"
            style={{ background: "#fff", color: "#000" }}
          >
            Cancel
          </button>
          <button
            className="saveBtn"
            style={{
              backgroundColor: "rgba(0, 224, 158, 0.62)",
              color: "#fff",
            }}
          >
            Save Changes
          </button>
        </InputBtnGroup>
      </InputGroup>
    </AccountInfoSection>
  );
};

export default AccountInfo;
