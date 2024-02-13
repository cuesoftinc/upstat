import { ProtectedRoute } from "@/components/otherComponents/protectRoute/ProtectedRoute";

const Bounce = () => {
  return (
    <ProtectedRoute>
      <section className="dummy-classname">
        <h2>Bounce rate goes here</h2>
      </section>
    </ProtectedRoute>
  );
};

export default Bounce;
