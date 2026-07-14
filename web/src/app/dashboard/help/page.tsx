import { ProtectedRoute } from "@/components/other-components/protect-route/ProtectedRoute";

const Help = () => {
  return (
    <ProtectedRoute>
      <section className="dummy-classname">
        <h2>Help goes here</h2>
      </section>
    </ProtectedRoute>
  );
};

export default Help;
