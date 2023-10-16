import React, { useRef, useState } from "react";
import {
  AccountInfoSection,
  InputBox,
  InputBtnGroup,
  InputGroup,
  ProfileButton,
  ProfileContainer,
} from "./AccountInfo.styles";
import profile from "../../../../assets/images/profile.png";
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
          <input type="text" name="fullName" />
        </InputBox>

        <InputBox>
          <label htmlFor="phone">Phone</label>
          <input type="tel" name="phone" />
        </InputBox>

        <InputBox>
          <label htmlFor="email">Email</label>
          <input type="email" name="email" />
        </InputBox>
        <InputBox>
          <label htmlFor="country">Country</label>
          <select name="country" id="country">
            <option value=""> </option>
            <option value=""> Nigeria</option>
          </select>
        </InputBox>
        <InputBox>
          <label htmlFor="timeZone">Time Zone</label>
          <select name="" id="">
            <option value=""> </option>
            <option value=""> GMT+1</option>
          </select>
        </InputBox>

        <InputBtnGroup>
          <button className="cancelBtn">Cancel</button>
          <button className="saveBtn">Save Changes</button>
        </InputBtnGroup>
      </InputGroup>
    </AccountInfoSection>
  );
};

export default AccountInfo;
