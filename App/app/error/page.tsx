import { ProtectedRoute } from "@/components/otherComponents/protectRoute/ProtectedRoute";

const Error = () => {
  return (
    <ProtectedRoute>
      <section className="dummy-classname">
        <h2>Error rate goes here</h2>
      </section>
    </ProtectedRoute>
  );
};

export default Error;
