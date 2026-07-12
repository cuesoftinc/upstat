import { ProtectedRoute } from "@/components/otherComponents/protectRoute/ProtectedRoute";
import Mainpage from "@/components/uptime/allPages/MainPage";

const Uptime = () => {
  return (
    <ProtectedRoute>
      <Mainpage />
    </ProtectedRoute>
  );
};

export default Uptime;
