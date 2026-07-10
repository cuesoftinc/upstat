const ENVOY_BASE_URL = process.env.NEXT_PUBLIC_ENVOY_BASE_URL || "http://localhost:8081";

interface GoogleAuthResponse {
  id: string;
  name: string;
  email: string;
  token: string;
  status: string;
  data: string;
}

/**
 * Calls the backend's GoogleAuth RPC endpoint via Envoy
 * Sends the Google id_token and receives user data + backend token
 */
export async function authenticateWithBackend(idToken: string): Promise<GoogleAuthResponse | null> {
  try {
    const response = await fetch(`${ENVOY_BASE_URL}/proto.UserService/GoogleAuth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-User-Agent": "grpc-web-javascript/0.1",
      },
      body: JSON.stringify({
        id_token: idToken,
      }),
    });

    if (!response.ok) {
      console.error(`Backend auth failed with status ${response.status}`);
      return null;
    }

    const data: GoogleAuthResponse = await response.json();
    return data;
  } catch (error) {
    console.error("Error calling backend auth service:", error);
    return null;
  }
}
