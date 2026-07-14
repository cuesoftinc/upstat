import { ProtectedRoute } from "@/components/other-components/protect-route/ProtectedRoute";

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
