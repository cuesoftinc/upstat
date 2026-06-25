import * as jspb from "google-protobuf";

export class GoogleAuthRequest extends jspb.Message {
  getIdToken(): string {
    return jspb.Message.getFieldWithDefault(this, 1, "");
  }

  setIdToken(value: string): GoogleAuthRequest {
    jspb.Message.setField(this, 1, value);
    return this;
  }

  override toObject(includeInstance?: boolean): GoogleAuthRequest.AsObject {
    return {
      idToken: this.getIdToken()
    };
  }

  serializeBinary(): Uint8Array {
    const writer = new jspb.BinaryWriter();
    GoogleAuthRequest.serializeBinaryToWriter(this, writer);
    return writer.getResultBuffer();
  }

  static serializeBinaryToWriter(message: GoogleAuthRequest, writer: jspb.BinaryWriter): void {
    const f = message.getIdToken();
    if (f.length > 0) {
      writer.writeString(1, f);
    }
  }

  static deserializeBinary(bytes: Uint8Array): GoogleAuthRequest {
    const reader = new jspb.BinaryReader(bytes);
    const msg = new GoogleAuthRequest();
    while (reader.nextField()) {
      if (reader.isEndGroup()) break;
      switch (reader.getFieldNumber()) {
        case 1:
          msg.setIdToken(reader.readString());
          break;
        default:
          reader.skipField();
          break;
      }
    }
    return msg;
  }
}

export namespace GoogleAuthRequest {
  export type AsObject = {
    idToken: string;
  };
}

export class GetUserResponse extends jspb.Message {
  getId(): string { return jspb.Message.getFieldWithDefault(this, 1, ""); }
  setId(value: string): GetUserResponse { 
    jspb.Message.setField(this, 1, value); 
    return this; 
  }

  getName(): string { return jspb.Message.getFieldWithDefault(this, 2, ""); }
  setName(value: string): GetUserResponse { 
    jspb.Message.setField(this, 2, value); 
    return this; 
  }

  getEmail(): string { return jspb.Message.getFieldWithDefault(this, 3, ""); }
  setEmail(value: string): GetUserResponse { 
    jspb.Message.setField(this, 3, value); 
    return this; 
  }

  getToken(): string { return jspb.Message.getFieldWithDefault(this, 4, ""); }
  setToken(value: string): GetUserResponse { 
    jspb.Message.setField(this, 4, value); 
    return this; 
  }

  getStatus(): string { return jspb.Message.getFieldWithDefault(this, 5, ""); }
  setStatus(value: string): GetUserResponse { 
    jspb.Message.setField(this, 5, value); 
    return this; 
  }

  getData(): string { return jspb.Message.getFieldWithDefault(this, 6, ""); }
  setData(value: string): GetUserResponse { 
    jspb.Message.setField(this, 6, value); 
    return this; 
  }

  override toObject(includeInstance?: boolean): GetUserResponse.AsObject {
    return {
      id: this.getId(),
      name: this.getName(),
      email: this.getEmail(),
      token: this.getToken(),
      status: this.getStatus(),
      data: this.getData(),
    };
  }

    serializeBinary(): Uint8Array {
    const writer = new jspb.BinaryWriter();
    const id = this.getId(); if (id.length > 0) writer.writeString(1, id);
    const name = this.getName(); if (name.length > 0) writer.writeString(2, name);
    const email = this.getEmail(); if (email.length > 0) writer.writeString(3, email);
    const token = this.getToken(); if (token.length > 0) writer.writeString(4, token);
    const status = this.getStatus(); if (status.length > 0) writer.writeString(5, status);
    const data = this.getData(); if (data.length > 0) writer.writeString(6, data);
    return writer.getResultBuffer();
  }

  static deserializeBinary(bytes: Uint8Array): GetUserResponse {
    const reader = new jspb.BinaryReader(bytes);
    const msg = new GetUserResponse();
    while (reader.nextField()) {
      if (reader.isEndGroup()) break;
      switch (reader.getFieldNumber()) {
        case 1: msg.setId(reader.readString()); break;
        case 2: msg.setName(reader.readString()); break;
        case 3: msg.setEmail(reader.readString()); break;
        case 4: msg.setToken(reader.readString()); break;
        case 5: msg.setStatus(reader.readString()); break;
        case 6: msg.setData(reader.readString()); break;
        default: reader.skipField(); break;
      }
    }
    return msg;
  }
}

export namespace GetUserResponse {
  export type AsObject = {
    id: string;
    name: string;
    email: string;
    token: string;
    status: string;
    data: string;
  };
}