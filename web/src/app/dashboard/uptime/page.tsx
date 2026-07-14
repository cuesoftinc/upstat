import { ProtectedRoute } from "@/components/other-components/protect-route/ProtectedRoute";
import Mainpage from "@/components/uptime/all-pages/MainPage";

const Uptime = () => {
  return (
    <ProtectedRoute>
      <Mainpage />
    </ProtectedRoute>
  );
};

export default Uptime;
